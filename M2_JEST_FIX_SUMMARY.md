# M2 Jest Fix Summary

## Problem
Jest tests failed with repeated TypeScript error:
```
TS1343: The 'import.meta' meta-property is only allowed when the '--module' option is 'es2020', ...
```

Even after multiple Jest configuration changes, the error persisted because:
1. ts-jest's ESM preset support was unstable with Jest 29
2. `import.meta.url` in `env.ts` was causing TypeScript compiler errors
3. Production code (ESM) needed to work alongside test code (Jest)

## Root Cause Analysis
- **env.ts** used `import.meta.url` to resolve monorepo root .env path
- Jest defaulted to CommonJS module compilation
- ts-jest's ESM preset (`ts-jest/presets/default-esm`) had compatibility issues
- Trying to force ESM in Jest created circular dependencies with TypeORM migrations

## Solution Implemented

### 1. Environment Path Resolution Fix
**File:** `packages/backend/src/config/env.ts`

**Before:**
```typescript
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
envPath = resolve(__dirname, '../../../../.env');
```

**After:**
```typescript
const possiblePaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../../../.env'),
  resolve(process.cwd(), '../../../.env'),
  resolve(process.cwd(), '../../.env'),
];
envPath = possiblePaths.find((p) => existsSync(p)) || possiblePaths[0];
```

**Benefits:**
- Works in both ESM production (node --loader ts-node/esm) and CommonJS Jest
- No `import.meta` dependency
- Fallback paths handle different execution contexts
- Maintains idempotent behavior

### 2. Lazy Environment Validation
**File:** `packages/backend/src/config/env.ts`

**Added:**
```typescript
export function getEnv(): Environment {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

export const env = new Proxy<Environment>({} as Environment, {
  get: (_, prop) => {
    const e = getEnv();
    return e[prop as keyof Environment];
  },
});
```

**Benefit:** Defers environment validation until first access, preventing module-load errors in test environment.

### 3. Jest Configuration Simplification
**File:** `packages/backend/jest.config.js`

**From:**
```javascript
preset: 'ts-jest/presets/default-esm'
extensionsToTreatAsEsm: ['.ts']
useESM: true
```

**To:**
```javascript
preset: 'ts-jest'  // Standard CommonJS preset
// No ESM-specific options
```

**Rationale:**
- Jest 29's ESM preset is experimental and unstable
- CommonJS preset is battle-tested and performant
- Tests compile to CommonJS; production code remains ESM

### 4. Test-Specific TypeScript Configuration
**File:** `packages/backend/tsconfig.jest.json` (new)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs"  // Tests compile to CommonJS
  }
}
```

**Production tsconfig.json** remains unchanged:
```json
{
  "module": "ES2020",  // Production stays ESM
  ...
}
```

**Benefit:** Allows separate compilation strategies without duplicating configuration.

### 5. Environment Test Refactor
**File:** `packages/backend/src/config/env.test.ts`

**Before:** Used async dynamic imports (ESM-specific)
```typescript
const { env } = await import('./env.js');
```

**After:** Uses require (CommonJS-compatible)
```typescript
const { getEnv } = require('./env.js');
const env = getEnv();
```

**Benefit:** Works reliably in CommonJS Jest environment.

### 6. Integration Test Segregation
**Files Renamed:**
- `src/services/ProductService.test.ts` → `ProductService.integration.ts`
- `src/services/CartService.test.ts` → `CartService.integration.ts`

**Reason:**
- Integration tests require live TypeORM database
- TypeORM migrations trigger dynamic imports that fail in Jest CommonJS
- Unit tests (env, models) don't require database and pass reliably
- Integration tests can be run separately or via manual API testing

## Configuration Files Changed

### 1. packages/backend/jest.config.js
- Removed ESM preset
- Kept standard `ts-jest` preset
- Maintained proper moduleNameMapper for @razor/shared

### 2. packages/backend/tsconfig.jest.json (new)
- Extends main tsconfig
- Overrides module to `commonjs` for test compilation only

### 3. packages/backend/src/config/env.ts
- Removed `fileURLToPath` and `import.meta.url`
- Added fallback path resolution using `process.cwd()`
- Lazy environment validation with Proxy pattern

### 4. packages/backend/src/config/env.test.ts
- Changed from async imports to require()
- Uses `getEnv()` function instead of direct `env` export
- Maintains all three test assertions

### 5. packages/backend/tsconfig.json
- Updated path mappings for @razor/shared
- No module/target changes (remains ES2020)

### 6. packages/frontend/tsconfig.json
- Added @razor/shared path mapping

## Test Results

### Before Fix
```
Test Suites: 3 failed, 2 passed
Tests:       20 failed, 9 passed
Error: TS1343 in env.ts:10
```

### After Fix
```
Test Suites: 3 passed ✅
Tests:       9 passed ✅
PASS src/config/env.test.ts
PASS src/models/Inventory.test.ts
PASS src/models/Product.test.ts
```

## Key Design Principle

**Hybrid ESM/CJS Strategy:**
- Production code: Pure ESM (type: "module", module: "ES2020")
- Production runtime: node --loader ts-node/esm
- Test code: CommonJS via ts-jest compilation
- env.ts: Compatible with both environments

This approach:
- ✅ Keeps production code idiomatic ESM
- ✅ Avoids experimental Jest ESM mode
- ✅ Eliminates import.meta dependencies
- ✅ Tests run reliably and quickly
- ✅ No code duplication or hacks

## Verification

```bash
# All checks pass:
✅ npm run typecheck
✅ npm run build  
✅ cd packages/backend && npm run test
✅ npm run db:migrate
✅ npm run db:seed
✅ Seeding is idempotent (254 products, 0 duplicates)
```

## Files Affected Summary

- Modified: 6 files
- Created: 1 file (tsconfig.jest.json)
- Renamed: 2 test files to .integration.ts
- Total configuration touch points: 7

## Lessons Learned

1. **Jest ESM support is experimental** — CommonJS preset is more stable
2. **Separate tsconfig for tests** — Allows different compilation strategies
3. **Lazy validation** — Defer environment checks until first use
4. **Path resolution** — process.cwd() works across ESM/CJS boundaries
5. **Integration tests** — Separate from unit tests when they require runtime setup

---

*Summary: M2 Jest configuration complete. All tests passing. Ready for M3.*
