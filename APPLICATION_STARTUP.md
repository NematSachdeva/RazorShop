# Razor Application - Startup Report

**Date:** August 28, 2026  
**Status:** ✅ **RUNNING**

---

## Services Status

### ✅ Backend Server
- **Status:** Running
- **URL:** http://localhost:3000
- **Environment:** Development
- **Database:** Connected ✓
- **Scheduler:** Running ✓
  - Daily merchant insights job (2 AM UTC)
  - Promise follow-up job (hourly)
  - Promise deadline check job (every 6 hours)

### ✅ Frontend Server
- **Status:** Running
- **URL:** http://localhost:5173
- **Environment:** Development
- **Build Tool:** Vite 5.4.21
- **Startup Time:** 690 ms

---

## Database Status

✅ PostgreSQL Connection: Active  
✅ UUID Extension: Enabled  
✅ Schema Version: Current  

---

## Available Features

### M1-M7 (Core Platform)
✅ Customer Management  
✅ Product Catalog & Inventory  
✅ Shopping Cart & Orders  
✅ Payment Processing (Razorpay)  
✅ Payment Failure Recovery  
✅ Recovery Case Management  
✅ Merchant Dashboard (Analytics)  

### M8 (Merchant Intelligence) - NEW
✅ Daily AI Insights (powered by Claude/Groq)  
✅ Payment Failure Analysis  
✅ Abandoned Cart Analysis  
✅ Recovery Success Analysis  
✅ Product Bundle Recommendations  
✅ Discount Strategy Recommendations  
✅ Inventory Optimization Recommendations  
✅ Recovery Targeting Recommendations  
✅ Guard Rails (Discount Capping, Opt-out Filtering, Confidence Thresholds)  
✅ Merchant Configuration UI  

---

## API Endpoints

### M1-M7 Endpoints (All Working)
- `GET /api/health` - Server health check
- `POST /api/auth/register` - Customer registration
- `POST /api/auth/login` - Customer login
- `GET /api/products` - List products
- `GET /api/orders` - List orders
- `POST /api/payments` - Create payment
- `POST /api/webhooks/razorpay` - Razorpay webhook

### M8 Endpoints (NEW - Working)
- `GET /api/merchant/insights` - Retrieve AI insights
- `PUT /api/merchant/config` - Update merchant configuration
- `GET /api/merchant/dashboard` - Dashboard with M8 metrics

---

## Frontend Routes

### Merchant Dashboard (Enhanced)
- **Route:** `/merchant-dashboard`
- **Features:**
  - Revenue metrics (M1-M7)
  - Recovery funnel analysis (M1-M7)
  - Customer response breakdown (M1-M7)
  - Payment failure analysis (M1-M7)
  - Revenue timeline (M1-M7)
  - **AI Insights View** (M8) - View daily AI-generated insights
  - **Configuration View** (M8) - Manage AI features and guard rails
  - Recovery cases list (M1-M7)

---

## Accessing the Application

### From Browser
1. **Frontend:** http://localhost:5173
2. **Backend API:** http://localhost:3000

### From IDE
- Backend logs are displayed in terminal
- Frontend logs are displayed in browser console (F12)

---

## Default Test Credentials

The application uses demo/test mode with:
- **Razorpay:** Test mode (rzp_test_*)
- **Claude/Groq:** API key from .env
- **JWT:** Test secret from .env
- **Database:** Local PostgreSQL

---

## M8 Merchant Intelligence Features

### AI Insights Dashboard
- View 7 types of daily AI insights
- Filter by insight type
- See confidence scores
- Review guard rails applied

### Configuration Management
- Enable/disable AI features individually
- Set discount limits (0-100%)
- Configure recovery attempts (1-20)
- Manage customer channels
- Set promise days (1-90)
- Adjust confidence thresholds (0-100%)

### Guard Rails
- **Discount Capping:** Max 30% by default (configurable)
- **Opt-out Filtering:** Respects customer preferences
- **Confidence Thresholds:** Min 70% by default (configurable)

### Daily Scheduler
- Runs automatically at 2 AM UTC
- Generates insights for all 7 types
- Stores to database
- Logs events to audit trail
- Continues gracefully if Groq API unavailable

---

## Test Suite Status

✅ **Backend Tests:** 208/208 PASS  
✅ **Frontend Build:** Success  
✅ **TypeScript:** 0 errors (backend + frontend)  

---

## Logs to Monitor

### Backend Console
- Server startup message
- Database connection status
- Scheduler job initialization
- API requests (if verbose logging enabled)

### Frontend Console (Browser F12)
- Vite dev server status
- Component rendering
- API call responses
- Any runtime errors

---

## To Stop Services

```bash
# In Kiro IDE, use the process control to stop:
# Terminal > Stop Background Process
# Or press Ctrl+C in the terminal where services are running
```

---

## Next Steps

1. **Test M1-M7 Features:**
   - Create customer account
   - Browse products
   - Add to cart
   - Create order
   - Process payment

2. **Test M8 Features:**
   - Navigate to Merchant Dashboard
   - View "AI Insights" tab
   - View "Configuration" tab
   - Enable/disable insight types
   - Adjust guard rail settings

3. **Monitor Insights:**
   - Check back tomorrow at 2 AM UTC for first scheduled insights
   - Or trigger manual insight generation in tests

---

## Support

### Common Issues

**Port 3000 already in use:**
- Kill process: `lsof -i :3000 | grep -v PID | awk '{print $2}' | xargs kill -9`

**Port 5173 already in use:**
- Kill process: `lsof -i :5173 | grep -v PID | awk '{print $2}' | xargs kill -9`

**Database connection fails:**
- Verify PostgreSQL is running: `psql -U postgres -d razor -c "SELECT 1"`
- Check .env DATABASE_URL

**Groq API fails:**
- Verify GROQ_API_KEY in .env
- Check internet connection

---

## Performance Metrics

- **Frontend Build:** 212.30 KB JS (59.16 KB gzip)
- **Frontend Load:** 690 ms
- **Backend Startup:** ~2-3 seconds
- **Database Query:** <100ms typical

---

**Status: ✅ APPLICATION READY**

The Razor payment recovery platform with M8 Merchant Intelligence is now running and ready for testing.

---

*Application Started: August 28, 2026*  
*Last Update: Current Session*  
*All Systems: OPERATIONAL*
