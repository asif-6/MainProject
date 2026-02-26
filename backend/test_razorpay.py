"""
Razorpay Integration Test Script
Run this to verify Razorpay is properly configured
"""

import sys
import os

# Add the project directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
django.setup()

from django.conf import settings
import razorpay

def test_razorpay_configuration():
    print("=" * 50)
    print("🔧 Razorpay Configuration Test")
    print("=" * 50)
    
    # Check if keys are configured
    print("\n1. Checking API Keys...")
    key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
    key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
    
    if not key_id or key_id == 'rzp_test_your_key_id':
        print("   ❌ RAZORPAY_KEY_ID not configured properly")
        print("   📝 Please update backend/backend/settings.py")
        return False
    else:
        print(f"   ✅ Key ID: {key_id[:15]}...")
    
    if not key_secret or key_secret == 'your_key_secret':
        print("   ❌ RAZORPAY_KEY_SECRET not configured properly")
        print("   📝 Please update backend/backend/settings.py")
        return False
    else:
        print(f"   ✅ Key Secret: {'*' * 20}")
    
    # Try to initialize Razorpay client
    print("\n2. Testing Razorpay Client...")
    try:
        client = razorpay.Client(auth=(key_id, key_secret))
        print("   ✅ Razorpay client initialized successfully")
    except Exception as e:
        print(f"   ❌ Failed to initialize client: {e}")
        return False
    
    # Try to create a test order
    print("\n3. Testing Order Creation...")
    try:
        test_order = client.order.create(data={
            'amount': 10000,  # 100 INR in paise
            'currency': 'INR',
            'receipt': 'test_receipt_001',
            'notes': {'test': 'true'}
        })
        print(f"   ✅ Test order created: {test_order['id']}")
        print(f"   Amount: ₹{test_order['amount'] / 100}")
        print(f"   Status: {test_order['status']}")
    except Exception as e:
        print(f"   ❌ Failed to create order: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("✅ Razorpay is configured correctly!")
    print("=" * 50)
    print("\n📝 Next Steps:")
    print("   1. Start backend: python manage.py runserver")
    print("   2. Start frontend: npm run dev")
    print("   3. Test payment with card: 4111 1111 1111 1111")
    print("\n")
    return True

if __name__ == '__main__':
    try:
        test_razorpay_configuration()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure you're running this from the backend directory:")
        print("   cd backend")
        print("   python test_razorpay.py")
