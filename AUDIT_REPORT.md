# Post-Fix Audit Report: Razorpay Payment Flow

**Date:** August 26, 2026  
**Scope:** Review of fixes for race conditions, duplicate payments, and concurrent request handling  
**Build Status:** ✅ PASSED (no TypeScript errors)

---

## Executive Summary

**Fixes Status:** 3 of 4 fixes are CORRECT. 1 issue remains.

| Issue | Status | Details |
|-------|--------|---------|
| PostgreSQL Race Condition | ✅ FIXED | INSERT ... ON CONFLICT prevents duplicate-key errors |
| React.StrictMode Double Invoke | ✅ FIXED | initializationAttempted flag guards useEffect |
| Checkout Order Duplication | ✅ FIXED | orderCreationAttempted flag + backend pessimistic locking |
| React DOM Nesting Warning | ✅ FIXED | Changed <p> to <div>, no block elements nested in inline |
| **REMAINING BUG** | ⚠️ RACE CONDITION | Razorpay order duplication on concurrent /payments/create |

---

## SECTION A: FIXES THAT ARE CORRECT

### Fix 1: PostgreSQL INSERT ... ON CONFLICT (✅ VERIFIED CORRECT)

**File:** `packages/backend/src/services/PaymentService.ts`, lines 148-160

**Implementation:**
```typescript
const paymentResult = await queryRunner.query(
  `
  INSERT INTO "payments" ("id", "order_id", "amount_cents", "status", "created_at", "updated_at")
  VALUES (gen_random_uuid(), $1, $2, 'initiated', now(), now())
  ON CONFLICT ("order_id") 
  DO UPDATE SET "updated_at" = now()
  RETURNING "id", "order_id", "amount_cents", "status", "created_at", "updated_at"
  `,
  [orderId, order.total_cents]
);
```

**Why This Is Correct:**
- PostgreSQL INSERT ... ON CONFLICT is an atomic operation
- Both the INSERT and the conflict check happen in a single DB operation
- No race window: either INSERT succeeds OR UPDATE executes, never partial
- Returns Payment record regardless of which branch executed
- UNIQUE constraint on `order_id` is respected

**Prevents:**
- Duplicate-key violation from concurrent requests
- Multiple Payment rows per Order
- HTTP 500 errors on second concurrent request

**Verified Data Model:**
```
payments table: ONE row per order_id (UNIQUE constraint)
payment_attempts table: MANY rows per order_id (no unique constraint)
```

---

### Fix 2: React.StrictMode Double-Invoke Guard (✅ VERIFIED CORRECT)

**File:** `packages/frontend/src/components/PaymentPage.tsx`, lines 91-92, 98-103

**Implementation:**
```typescript
const [initializationAttempted, setInitializationAttempted] = useState(false);

useEffect(() => {
  // Skip if already attempted (prevents React.StrictMode double-invoke)
  if (initializationAttempted) {
    return;
  }

  const initPayment = async () => { ... };

  setInitializationAttempted(true);
  initPayment();
}, [orderId, initializationAttempted]);
```

**Why This Is Correct:**
- First effect run: `initializationAttempted=false` → enters hook → sets `true` → calls `initPayment()`
- Second effect run (React.StrictMode): `initializationAttempted=true` → returns early (no API call)
- Dependency on `initializationAttempted` ensures state update triggers re-render and cleanup
- `orderId` change resets behavior: component remount → flag is `false` again

**Result:**
- Only ONE POST /api/payments/create per component mount
- React.StrictMode double-invoke no longer causes duplicate API calls

---

### Fix 3: Checkout Order Submission Guard (✅ VERIFIED CORRECT)

**File:** `packages/frontend/src/components/Checkout.tsx`, lines 22-62

**Frontend Protection:**
```typescript
const [orderCreationAttempted, setOrderCreationAttempted] = useState(false);

const handleCreateOrder = async () => {
  // Prevent double-submission
  if (loading || orderCreationAttempted) {
    return;  // Early return blocks execution
  }

  setLoading(true);
  setOrderCreationAttempted(true);

  try {
    const response = await fetch(getApiUrl('/orders'), { ... });
    // ... handle success
  } catch (err) {
    setOrderCreationAttempted(false);  // Reset on error to allow retry
    setLoading(false);
  }
};
```

**Backend Protection:**
OrderService (lines 75-76) uses pessimistic write locking:
```typescript
await queryRunner.startTransaction('SERIALIZABLE');
const cart = await queryRunner.manager
  .createQueryBuilder(Cart, 'cart')
  .setLock('pessimistic_write')  // <-- row-level lock
  .where('cart.id = :cartId', { cartId })
  .getOne();
```

**Two-Layer Protection:**
1. **Frontend**: Flag prevents multiple clicks/effect re-runs
2. **Backend**: First transaction locks cart row, second waits/fails with "already converted"

**Why This Is Correct:**
- Frontend guard blocks most double-submissions
- Backend guard catches any frontend bypasses (direct API calls, browser dev tools)
- SERIALIZABLE transaction level ensures consistent state
- Cart has `converted_to_order_id` check (line 82): prevents duplicate order creation

---

### Fix 4: React DOM Nesting (✅ VERIFIED CORRECT)

**File:** `packages/frontend/src/components/PaymentStatus.tsx`, lines 62-66

**Old Code (INVALID):**
```typescript
<p className={...}>
  {getSpinner()}  // Returns <div>
  {getStatusMessage()}  // Returns string
</p>
```

**New Code (VALID):**
```typescript
<div className={`${getStatusColor()} font-medium flex items-center justify-center gap-2`}>
  {getSpinner()}  // <div> - now valid block-level element
  <span>{getStatusMessage()}</span>  // Explicit span for text
</div>
```

**Why This Is Correct:**
- Block-level elements (`<div>`) cannot be children of inline elements (`<p>`)
- Wrapper is now a `<div>` (block-level), so `<div>` spinner is valid
- `<span>` for text content is correct for inline use
- Flexbox layout works properly with block/inline mix

---

## SECTION B: REMAINING BUGS

### ⚠️ BUG: Razorpay Order Duplication on Concurrent Requests

**Severity:** HIGH - Can create multiple Razorpay orders for same payment attempt

**Root Cause:**
The INSERT ... ON CONFLICT fix prevents duplicate Payment records BUT does not prevent multiple Razorpay order creation.

**Timeline of Bug:**

```
Time  Request A                                Request B
---   -----------                              -----------
T1    INSERT Payment (ON CONFLICT)
T2                                             INSERT Payment (ON CONFLICT)
T3    → INSERT succeeds, returns Payment A
T4                                             → CONFLICT detected, DO UPDATE
T5                                             → Returns same Payment A
T6    queryRunner.query("UPDATE payments..") [status='pending']
T7                                             queryRunner.query("UPDATE payments..") [status='pending']
T8    this.razorpayClient.createOrder()
T9                                             this.razorpayClient.createOrder()
T10   → Creates Razorpay Order X
T11                                            → Creates Razorpay Order Y
T12   CREATE PaymentAttempt (razorpay_order_id=X, attempt_number=1)
T13                                            CREATE PaymentAttempt (razorpay_order_id=Y, attempt_number=1)
T14   Returns razorpay_order_id: X
T15                                            Returns razorpay_order_id: Y
```

**Result:**
- ONE Payment record ✅
- TWO PaymentAttempt records with attempt_number=1 ❌ (should only be 1)
- TWO different Razorpay orders created ❌ (wasted API calls, confusing state)
- Frontend gets two different razorpay_order_ids ❌

**Why This Happens:**
Lines 155-161 in PaymentService.ts:
```typescript
const paymentData = paymentResult[0];  // Both requests get here

// ... line 172+ check status
if (paymentData.status !== 'initiated') {
  // BOTH requests see status='initiated' on first run
  // So BOTH skip the retry logic
}

// ... line 181 - BOTH create Razorpay orders
const razorpayOrder = await this.razorpayClient.createOrder(...);
```

The code correctly gets the same Payment record (thanks to INSERT ... ON CONFLICT), but then BOTH requests proceed to create separate Razorpay orders because the Payment status check happens after the INSERT ON CONFLICT, using the INITIALLY CREATED payment record (which has status='initiated').

**Evidence:**
Looking at the code flow:
- Lines 163-170: Payment retrieval via INSERT ON CONFLICT ✅
- Lines 172-180: Status check logic (should prevent retry, but doesn't prevent double init) ⚠️
- Lines 181: `razorpayClient.createOrder()` is called regardless ❌
- Lines 183-187: Both create PaymentAttempt records with attempt_number=1 ❌

---

## SECTION C: CONCURRENCY ANALYSIS

### What Happens With Two Simultaneous POST /api/payments/create

**Scenario:** Two requests arrive 0ms apart for order_id = `X`

**Step-by-Step Timeline:**

```
Transaction A (Request 1)          Transaction B (Request 2)
-----------------------------      ---------------------------
BEGIN TRANSACTION                  
  ↓                                BEGIN TRANSACTION
  Verify order exists ✅            ↓
  ↓                                Verify order exists ✅
  INSERT Payment ON CONFLICT       ↓
  → INSERT succeeds (A wins race)  INSERT Payment ON CONFLICT
  ↓                                → CONFLICT on order_id
  paymentData = Payment {           → DO UPDATE returns same Payment
    status: 'initiated',           ↓
    id: pay_123                    paymentData = Payment {
  }                                  status: 'initiated', (same record!)
  ↓                                  id: pay_123 (same ID!)
  Check: status === 'initiated'? YES}
  ↓                                ↓
  attemptNumber = 1                Check: status === 'initiated'? YES
  ↓                                ↓
  createRazorpayOrder()            attemptNumber = 1
  → Razorpay Order X created       ↓
  ↓                                createRazorpayOrder()
  CREATE PaymentAttempt #1:        → Razorpay Order Y created
    razorpay_order_id: X           ↓
    attempt_number: 1              CREATE PaymentAttempt #1:
  ↓                                  razorpay_order_id: Y
  UPDATE Payment status='pending'    attempt_number: 1
  ↓                                ↓
  COMMIT                           UPDATE Payment status='pending'
  ↓                                ↓
  Return:                          COMMIT
    razorpay_order_id: X           ↓
                                   Return:
                                     razorpay_order_id: Y
```

**Database Final State:**
```
payments:
  id: pay_123
  order_id: X
  status: 'pending'
  (1 row) ✅

payment_attempts:
  id: pa_1, order_id: X, razorpay_order_id: X, attempt_number: 1
  id: pa_2, order_id: X, razorpay_order_id: Y, attempt_number: 1  ❌ DUPLICATE
  (2 rows) - INCORRECT!
```

**HTTP Responses:**
- Request 1: `200 OK { razorpay_order_id: X }`
- Request 2: `200 OK { razorpay_order_id: Y }`  ← Frontend gets different ID!

**Problems:**
1. Two PaymentAttempts with identical `attempt_number=1`
2. Two Razorpay orders created (wasted API calls)
3. Frontend receives different razorpay_order_ids
4. Database integrity violation (duplicate attempt numbers)

---

## SECTION D: RETRY FLOW

### Correct Flow (Works as Expected)

**Initial Payment Attempt:**

```
App component mounts
  ↓
User adds item to cart
  ↓
User clicks "Proceed to Checkout"
  → Checkout component mounts
  → handleCreateOrder() called ONCE (orderCreationAttempted guard)
  ↓
POST /api/orders
  → OrderService.createOrderFromCart()
  → Pessimistic write lock on cart
  → Creates Order with status='pending'
  → Marks cart as converted
  ↓
App receives orderId
  ↓
App mounts PaymentPage with orderId
  → PaymentPage useEffect runs
  → initializationAttempted=false → sets true → calls initPayment()
  → (if React.StrictMode tries again: initializationAttempted=true → returns early)
  ↓
POST /api/payments/create (Request 1 only, no duplicates)
  ↓
PaymentService.createPaymentAttempt(orderId)
  → INSERT Payment ON CONFLICT → creates Payment with status='initiated'
  → paymentData.status === 'initiated' (first attempt)
  → attemptNumber = 1
  → createRazorpayOrder() → order_ABC
  → CREATE PaymentAttempt #1 (razorpay_order_id: order_ABC, attempt_number: 1)
  → UPDATE Payment status='pending'
  ↓
Frontend receives razorpay_order_id: order_ABC
  ↓
Frontend displays PaymentPage with "Pay Now" button
  ↓
User clicks "Pay Now"
  → Opens Razorpay Checkout with razorpay_order_id: order_ABC
  ↓
Razorpay modal shows UPI options
  ↓
User CANCELS payment (closes modal without paying)
  → modal.ondismiss() fires
  → setPaymentStatus('ready')
  → setError('Payment cancelled')
  ↓
PaymentPage shows failed state with "Retry Payment" button
```

**Retry After Failed Payment:**

```
User clicks "Retry Payment" button
  → onClick handler (lines 239-263)
  → setPaymentStatus('loading')
  ↓
POST /api/payments/create (Request 2 for same order)
  ↓
PaymentService.createPaymentAttempt(orderId)
  → INSERT Payment ON CONFLICT
  → Conflict detected (payment already exists)
  → DO UPDATE returns existing Payment
  → paymentData.status === 'pending' (from previous attempt)
  ↓
  Check: if (paymentData.status !== 'initiated') → TRUE (status is 'pending')
  ↓
  Get last attempt: SELECT PaymentAttempt WHERE order_id=X ORDER BY attempt_number DESC
  → lastAttempt.attempt_number = 1
  ↓
  Check: if (paymentData.status === 'captured') → FALSE (status is 'pending')
  ↓
  Check: if (paymentData.status !== 'failed' && paymentData.status !== 'pending') → FALSE
  (status IS 'pending', so condition is false, doesn't throw)
  ↓
  Check: if (paymentData.status === 'failed') → FALSE
  ↓
  ISSUE: No attempt created because status is 'pending', not 'failed'!
  ↓
  Line 180: throw new Error('Cannot create new payment attempt while one is pending')
  → HTTP 409 Conflict
  ↓
Frontend receives 409 error
  → setError('Cannot create new payment attempt while one is pending')
  → setPaymentStatus('failed')
  ↓
User sees error message and cannot retry
```

**Expected Flow (What Should Happen):**

After user cancels payment in Razorpay without paying:
1. Payment status should be marked as 'failed' (but it's not - still 'pending')
2. Next retry should increment attempt_number
3. New Razorpay order should be created

**The Problem:**
- When user cancels Razorpay modal, `modal.ondismiss()` fires but nothing marks the Payment as 'failed'
- Backend only sees status='pending' from initial creation
- Retry logic requires status='failed' to allow new attempt

---

## SECTION E: ORDER DUPLICATION

### Can Multiple Orders Be Created From Same Cart?

**Answer:** NO (cannot happen)

**Frontend Protection:**
```typescript
const [orderCreationAttempted, setOrderCreationAttempted] = useState(false);

if (loading || orderCreationAttempted) {
  return;  // Blocks second call
}
```

**Backend Protection (STRONGER):**
OrderService (lines 82):
```typescript
if (cart.converted_to_order_id) {
  throw new Error('Cart has already been converted to an order');
}
```

Even if frontend somehow calls twice:
1. First call: Cart is locked, order created, cart.converted_to_order_id set
2. Second call: Cart is locked by first transaction, second waits
3. When second lock acquired: cart.converted_to_order_id is already set
4. Throws 409 Conflict

**Result:** Cannot create duplicate orders

---

## SECTION F: DUPLICATE FRONTEND REQUESTS

### Why Original Frontend Generated Duplicate Requests

**Root Cause 1: React.StrictMode Double-Invoke**
- In development, React.StrictMode intentionally runs effects twice
- Original PaymentPage had no guard:
  ```typescript
  useEffect(() => {
    initPayment();  // Runs twice
  }, [orderId]);
  ```

**Root Cause 2: Possible Browser/Network**
- Browser network tab showed 09:16:08.891 and 09:16:08.902 (11ms apart)
- Could be: StrictMode + actual double-click or effect re-run

**Current Implementation Eliminates:**
- ✅ React.StrictMode double-invoke (initializationAttempted flag)
- ✅ Accidental double-clicks (Checkout button has loading state)
- ✅ Effect re-runs (orderId change resets but doesn't re-trigger within same mount)

---

## SECTION G: PAYMENT ATTEMPT NUMBER

### Is attempt_number Generation Concurrency-Safe?

**Current Implementation (Line 167-169):**
```typescript
const lastAttempt = await queryRunner.manager.findOne(PaymentAttempt, {
  where: { order_id: orderId },
  order: { attempt_number: 'DESC' },
});

attemptNumber = (lastAttempt?.attempt_number || 0) + 1;
```

**Analysis:**
- Uses MAX(attempt_number) + 1 pattern
- Running inside transaction ✅
- But: Two concurrent requests can both see same lastAttempt.attempt_number

**Concurrency Issue:**
```
Request A                          Request B
---------                          ---------
SELECT MAX(attempt_number)
→ lastAttempt.attempt_number = 1
                                  SELECT MAX(attempt_number)
                                  → lastAttempt.attempt_number = 1
attemptNumber = 1 + 1 = 2
                                  attemptNumber = 1 + 1 = 2
INSERT PaymentAttempt attempt=2
                                  INSERT PaymentAttempt attempt=2
Result: TWO rows with attempt_number=2 ❌
```

**Current Status:**
- ⚠️ NOT concurrency-safe for attempt_number generation
- Combined with earlier bug (two Razorpay orders), results in duplicate attempt#1 entries
- Should use database-generated sequence or unique constraint

---

## SECTION H: PAYMENT VERIFICATION

### Verification Process (CORRECT)

**File:** PaymentService.verifyPayment() (lines 212-265)

**Flow:**
1. Find LATEST PaymentAttempt by attempt_number DESC (line 216-221)
2. Use Razorpay order ID from that attempt to verify signature (line 226-228)
3. Load Payment record (line 230-234)
4. Check Payment status (lines 236-240, 242-244)
5. Update Payment with razorpay_payment_id (line 249-251)
6. Update Order status to 'confirmed' (line 253-258)

**Verification:** 
- ✅ Uses latest PaymentAttempt (by attempt_number DESC)
- ✅ Old attempts cannot overwrite new success (check on line 242-244)
- ✅ Idempotent: same razorpay_payment_id = same signature verification (line 236-240)
- ✅ Only ONE Payment marked as captured per order

---

## SECTION I: REACT DOM WARNING

### Is DOM Nesting Warning Fixed?

**Answer:** YES ✅

**Old Code (INVALID):**
```html
<p class="...">
  <div class="inline-block animate-spin mr-2">...</div>  ← INVALID
  Initializing payment...
</p>
```

**New Code (VALID):**
```html
<div class="... flex items-center justify-center gap-2">
  <div class="inline-block animate-spin mr-2">...</div>  ← VALID
  <span>Initializing payment...</span>
</div>
```

**Why It's Fixed:**
- Wrapper is `<div>` (block-level container)
- `<div>` spinner is valid as child of `<div>` (block in block)
- `<span>` text is valid as child of `<div>` (inline in block)
- No inline elements containing block elements

---

## SECTION J: BUILD VERIFICATION

**Status:** ✅ PASSED

```
✓ @razor/backend: tsc → no errors
✓ @razor/frontend: tsc + vite build → no errors  
✓ @razor/shared: tsc → no errors
```

No TypeScript compilation errors.

---

## SECTION K: MANUAL TEST PLAN

### Test 1: First Payment Attempt (Single Success)

**Steps:**
1. Browser: Open app at http://localhost:5173
2. Add item to cart
3. Click "Proceed to Checkout"
4. Network tab: Watch for POST /api/orders
5. Verify: 1 POST /api/orders call only
6. Backend console: Watch for "Created order" log
7. Click "Proceed to Payment"
8. Network tab: Watch for POST /api/payments/create
9. Verify: 1 POST /api/payments/create call only
10. Console: Look for "[Payment] Created payment attempt" log
11. Database: SELECT * FROM payments WHERE order_id=X → 1 row
12. Database: SELECT * FROM payment_attempts WHERE order_id=X → 1 row
13. Click "Pay Now"
14. Complete Razorpay payment (test credentials)
15. Network tab: Watch for POST /api/payments/verify
16. Verify: Success page appears

**Expected Results:**
- Network: 1 order creation, 1 payment creation, 1 payment verify
- Database: 1 Payment (status='captured'), 1 PaymentAttempt (attempt_number=1)
- No 409 errors
- No DOM nesting warnings in console

---

### Test 2: Failed Payment (Cancel Modal)

**Steps:**
1. Add item to cart
2. Proceed to Checkout
3. Proceed to Payment
4. Click "Pay Now"
5. Razorpay modal appears with UPI QR
6. **Deliberately cancel** (close modal without scanning)
7. Network tab: Verify no POST to /api/payments/verify
8. Frontend: Should show "Payment cancelled" error
9. Click "Retry Payment"
10. Network tab: Watch for POST /api/payments/create (Request 2)
11. Backend console: Watch for attempt_number in log

**Expected Results:**
- **❌ CURRENTLY FAILS**: 409 Conflict "Cannot create new payment attempt while one is pending"
- Error: Status is 'pending' not 'failed', so retry blocked
- **REASON**: Payment status never transitions to 'failed' when user cancels Razorpay

**What Should Happen (But Doesn't):**
- Payment marked as 'failed' after cancellation
- Retry creates new PaymentAttempt with attempt_number=2
- New Razorpay order created

---

### Test 3: Multiple Retries

**Steps:**
1. Follow Test 1 & 2 up to first retry failure
2. Backend: Manually UPDATE payments SET status='failed' WHERE order_id=X
3. Click "Retry Payment" in UI
4. Network tab: POST /api/payments/create
5. Backend console: Check attempt_number
6. Database: SELECT * FROM payment_attempts → verify attempt_number sequence

**Expected Results:**
- **⚠️ POTENTIAL BUG**: Concurrent requests could create attempt#1, attempt#1 instead of attempt#1, attempt#2
- Should see:
  - PaymentAttempt #1: razorpay_order_id=order_ABC
  - PaymentAttempt #2: razorpay_order_id=order_XYZ (different)
- **ACTUAL (with bug)**: Both might have same attempt_number

---

### Test 4: Double-Click "Proceed to Checkout"

**Steps:**
1. Click "Proceed to Checkout" twice rapidly
2. Network tab: Watch POST /api/orders
3. Backend console: Watch for order creation logs

**Expected Results:**
- Network: Only 1 POST /api/orders
- Database: 1 Order created (not 2)
- Button disabled during loading prevents second execution

---

### Test 5: React.StrictMode Double-Invoke (Dev Mode)

**Steps:**
1. Verify React.StrictMode is enabled (check index.tsx)
2. Add item to cart
3. Proceed to Checkout
4. Proceed to Payment
5. Open Network tab
6. Clear network log
7. Refresh browser to trigger component mount
8. Watch Network tab during mount

**Expected Results:**
- Only 1 POST /api/payments/create request
- Previously: Would see 2 requests (09:16:08.891 and 09:16:08.902)
- Now: initializationAttempted flag prevents second call

---

### Test 6: PaymentStatus DOM Warning

**Steps:**
1. Open browser DevTools Console
2. Go through payment flow (any test above)
3. Monitor console during all PaymentPage renders

**Expected Results:**
- ✅ No "Cannot appear as a descendant of <p>" warning
- Warning should be gone (fixed)

---

### Test 7: Concurrent POST /api/payments/create (Manual Test)

**Steps:**
1. Open terminal: `curl` or similar tool
2. Create order via UI (record order_id)
3. Send two concurrent requests:
   ```bash
   curl -X POST http://localhost:3000/api/payments/create \
     -H "Content-Type: application/json" \
     -d '{"order_id":"<same-order-id>"}' &
   curl -X POST http://localhost:3000/api/payments/create \
     -H "Content-Type: application/json" \
     -d '{"order_id":"<same-order-id>"}' &
   ```
4. Database: SELECT COUNT(*) FROM payments WHERE order_id=X
5. Database: SELECT COUNT(*) FROM payment_attempts WHERE order_id=X

**Expected Results:**
- Network: 2 × 200 OK (not 500 or 409) ✅
- Database: 1 Payment row ✅
- Database: 2 PaymentAttempt rows ❌ **BUG** (should be 1)
- Both PaymentAttempt records have attempt_number=1 ❌ **BUG**
- Two different razorpay_order_ids ❌ **BUG**

---

## SECTION L: DATABASE EXPECTATIONS

### After One Initial Attempt

```sql
payments:
  ├─ id: pay_123
  ├─ order_id: order_A
  ├─ status: 'pending'
  └─ (1 row)

payment_attempts:
  ├─ id: pa_1
  ├─ order_id: order_A
  ├─ razorpay_order_id: order_ABC
  ├─ attempt_number: 1
  └─ (1 row)

Expected Rows: 1 Payment + 1 PaymentAttempt
```

### After One Failed Retry (Currently Blocked)

```
Cannot retry due to status='pending' check
Status should be 'failed' to allow retry
Currently: 1 Payment + 1 PaymentAttempt (no change)
Should be: 1 Payment + 2 PaymentAttempts (if allowed)
```

### After Two Failed Retries + Successful Third

```
payments:
  ├─ id: pay_123
  ├─ order_id: order_A
  ├─ status: 'captured'  ← only final success matters
  ├─ razorpay_payment_id: pay_XYZ123
  └─ (1 row)

payment_attempts:
  ├─ id: pa_1, attempt_number: 1, razorpay_order_id: order_ABC, status: (none)
  ├─ id: pa_2, attempt_number: 2, razorpay_order_id: order_DEF, status: (none)
  ├─ id: pa_3, attempt_number: 3, razorpay_order_id: order_GHI, status: (successful with pay_XYZ123)
  └─ (3 rows)

Expected: 1 Payment + 3 PaymentAttempts
```

### After Concurrent Requests for Same Order (BUG)

```
Current behavior (BUGGY):

payments:
  ├─ id: pay_123
  ├─ order_id: order_A
  ├─ status: 'pending'
  └─ (1 row)  ✅

payment_attempts:
  ├─ id: pa_1, attempt_number: 1, razorpay_order_id: order_ABC
  ├─ id: pa_2, attempt_number: 1, razorpay_order_id: order_XYZ  ← WRONG! duplicate attempt#1
  └─ (2 rows)  ❌ SHOULD BE 1

Actual Result: 1 Payment + 2 PaymentAttempts with duplicate attempt_number=1
Expected Result: 1 Payment + 1 PaymentAttempt with attempt_number=1
```

---

## SUMMARY TABLE

| Component | Status | Notes |
|-----------|--------|-------|
| INSERT ... ON CONFLICT | ✅ WORKS | Prevents duplicate Payment rows |
| React.StrictMode Guard | ✅ WORKS | Prevents duplicate /payments/create calls |
| Checkout Submission Guard | ✅ WORKS | Prevents duplicate order creation |
| Order Locking (Backend) | ✅ WORKS | Prevents concurrent cart conversion |
| DOM Nesting | ✅ FIXED | No more warnings |
| **Razorpay Order Duplication** | ❌ **BUG** | Two concurrent requests create 2 Razorpay orders |
| **PaymentAttempt Duplicate Numbers** | ❌ **BUG** | Concurrent requests both get attempt_number=1 |
| **Payment Retry After Cancel** | ❌ **BUG** | Payment stuck in 'pending', cannot retry without manual intervention |
| Verification | ✅ WORKS | Uses latest attempt, prevents overwrite |

---

## RECOMMENDATIONS

### Before Production:

1. **FIX CRITICAL**: Add unique constraint or database-level check to prevent duplicate PaymentAttempt records with same attempt_number
   - Add UNIQUE(order_id, attempt_number) constraint to payment_attempts table
   - Or use database sequence for attempt_number generation

2. **FIX CRITICAL**: Mark Payment as 'failed' when user cancels Razorpay modal
   - Backend endpoint to mark payment attempt as failed
   - Or: Only allow retry if latest PaymentAttempt is created but user didn't reach verification

3. **FIX IMPORTANT**: Prevent multiple Razorpay orders from being created on concurrent requests
   - Move Razorpay order creation before Payment INSERT
   - Or: Check if PaymentAttempt already exists for this attempt number before creating Razorpay order

### Current Safe Usage:

- ✅ Single user, sequential payments: Works correctly
- ✅ Multiple users, different orders: Works correctly
- ⚠️ Single order, concurrent requests: No 500 errors, but duplicate Razorpay orders created (wasted API calls)
- ❌ Payment retry after cancellation: Blocked, manual DB fix required
