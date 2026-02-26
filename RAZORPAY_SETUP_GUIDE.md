# 🎉 Razorpay Payment Integration - Complete Setup Guide

## ✅ Installation Complete

### Backend (Django)
- ✅ Razorpay Python SDK installed (`razorpay==2.0.0`)
- ✅ Payment views created with Razorpay integration
- ✅ New endpoints added for order creation and verification

### Frontend (React)
- ✅ Razorpay npm package installed
- ✅ Razorpay service created for payment handling
- ✅ UserDashboard updated with Razorpay integration

---

## 🔧 Configuration Required

### Step 1: Get Razorpay API Keys

1. **Sign up for Razorpay** (if you haven't already):
   - Visit: https://razorpay.com/
   - Create an account

2. **Get Test API Keys**:
   - Login to Razorpay Dashboard
   - Navigate to **Settings** → **API Keys**
   - Click on **Generate Test Key**
   - Copy both:
     - `Key ID` (starts with `rzp_test_`)
     - `Key Secret`

### Step 2: Update Backend Configuration

Open `backend/backend/settings.py` and replace the placeholder keys:

```python
# Razorpay Payment Gateway Configuration
RAZORPAY_KEY_ID = 'rzp_test_YOUR_ACTUAL_KEY_ID'  # Replace with your actual key
RAZORPAY_KEY_SECRET = 'YOUR_ACTUAL_KEY_SECRET'   # Replace with your actual secret
```

**Current settings location:** Line 156-157 in `backend/backend/settings.py`

---

## 🚀 New API Endpoints

### 1. Create Razorpay Order
**POST** `/api/create-razorpay-order/{order_id}/`
- Creates a Razorpay order for payment
- Returns Razorpay order ID and payment details

### 2. Verify Razorpay Payment
**POST** `/api/verify-razorpay-payment/{order_id}/`
- Verifies payment signature from Razorpay
- Updates order status to 'paid'
- Body:
  ```json
  {
    "razorpay_order_id": "order_xxx",
    "razorpay_payment_id": "pay_xxx",
    "razorpay_signature": "signature_xxx"
  }
  ```

### 3. Legacy Process Payment (for COD, etc.)
**POST** `/api/process-payment/{order_id}/`
- For non-Razorpay payment methods
- Body: `{ "payment_method": "cod" }`

---

## 💳 Payment Flow

### User Payment Journey:

```
1. User creates order
   ↓
2. UserDashboard shows payment modal
   ↓
3. User selects "Razorpay" as payment method
   ↓
4. User clicks "Pay Now"
   ↓
5. Frontend calls create-razorpay-order API
   ↓
6. Backend creates Razorpay order
   ↓
7. Razorpay checkout modal opens
   ↓
8. User completes payment on Razorpay
   ↓
9. Frontend receives payment response
   ↓
10. Frontend calls verify-razorpay-payment API
    ↓
11. Backend verifies signature with Razorpay
    ↓
12. Order status updated to 'paid'
    ↓
13. Success message shown to user
```

---

## 🧪 Testing with Test Cards

Razorpay provides test cards for development:

### Successful Payment:
- **Card Number:** `4111 1111 1111 1111`
- **CVV:** Any 3 digits (e.g., `123`)
- **Expiry:** Any future date (e.g., `12/25`)
- **Name:** Any name

### Failed Payment:
- **Card Number:** `4111 1111 1111 1234`
- **CVV:** `123`
- **Expiry:** `12/25`

### Test UPI:
- **UPI ID:** `success@razorpay`
- Result: Success

### Test Netbanking:
- Select any bank
- Username: `test`
- Password: `test`

---

## 📁 Files Modified/Created

### Backend Files:
1. `backend/backend/settings.py` - Added Razorpay configuration
2. `backend/medicine/views.py` - Added payment endpoints
3. `backend/medicine/urls.py` - Added payment routes

### Frontend Files:
1. `frontend/src/services/razorpayService.js` - NEW! Razorpay utilities
2. `frontend/src/services/dashboardApi.js` - Added Razorpay APIs
3. `frontend/src/components/UserDashboard.jsx` - Updated payment flow

---

## 🔒 Security Features

✅ **Payment Signature Verification** - All payments verified with HMAC signature
✅ **Server-side Validation** - Payment verification done on backend
✅ **Secure API Keys** - Keys stored in settings, not exposed to frontend
✅ **Transaction Tracking** - All payments logged in database

---

## 🎨 Payment Method Options

Users can now choose from:
1. **💳 Razorpay** (Recommended) - Card/UPI/Wallet/NetBanking
2. **Credit/Debit Card** (Legacy)
3. **UPI** (Legacy)
4. **Digital Wallet** (Legacy)
5. **Cash on Delivery**

---

## 📝 How to Use

### For Development/Testing:

1. **Start Backend Server:**
   ```bash
   cd backend
   python manage.py runserver
   ```

2. **Start Frontend Server:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test Payment Flow:**
   - Login as a user
   - Add medicine to cart
   - Create order
   - Select "Razorpay" payment method
   - Click "Pay Now"
   - Use test card: `4111 1111 1111 1111`
   - Complete payment
   - Verify order status changes to 'paid'

---

## 🐛 Troubleshooting

### Issue: Razorpay modal doesn't open
**Solution:** Check browser console for script loading errors. Ensure internet connection is stable.

### Issue: Payment verification fails
**Solution:** 
- Verify API keys in `settings.py`
- Check backend logs for signature verification errors
- Ensure order exists before payment

### Issue: "Payment failed" error
**Solution:**
- Use correct test card numbers
- Check Razorpay dashboard for transaction logs
- Verify backend is running

---

## 📊 Database Changes

Payment records now include:
- **payment_method**: Can be 'razorpay', 'card', 'upi', 'wallet', 'cod'
- **transaction_id**: Razorpay payment ID or generated transaction ID
- **status**: 'paid', 'pending', 'failed', 'refunded'

---

## 🎯 Next Steps

1. **Replace placeholder API keys** in `settings.py`
2. **Test payment flow** with test cards
3. **Monitor Razorpay dashboard** for transactions
4. **Configure webhooks** (optional) for payment notifications
5. **Switch to live keys** when ready for production

---

## 📞 Razorpay Support

- Documentation: https://razorpay.com/docs/
- Test Cards: https://razorpay.com/docs/payments/payments/test-card-details/
- Dashboard: https://dashboard.razorpay.com/

---

## ✨ Features Implemented

✅ Razorpay checkout integration
✅ Payment signature verification
✅ Multiple payment method support
✅ Test mode ready
✅ Error handling
✅ Transaction logging
✅ Order status updates
✅ User-friendly payment modal

**Your payment system is now ready to accept payments! 🎉**
