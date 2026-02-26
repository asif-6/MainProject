// Razorpay Payment Service

// Load Razorpay script dynamically
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

// Initialize Razorpay payment
export const initializeRazorpayPayment = async (orderData, onSuccess, onFailure) => {
  const res = await loadRazorpayScript();

  if (!res) {
    alert('Razorpay SDK failed to load. Please check your internet connection.');
    return;
  }

  const options = {
    key: orderData.razorpay_key_id, // Razorpay Key ID from backend
    amount: orderData.amount, // Amount in paise
    currency: orderData.currency,
    name: 'Medicine Delivery System',
    description: `Order #${orderData.order_id}`,
    order_id: orderData.razorpay_order_id, // Razorpay Order ID
    handler: function (response) {
      // Payment successful
      onSuccess({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });
    },
    prefill: {
      name: orderData.user_name || '',
      email: orderData.user_email || '',
      contact: orderData.user_phone || '',
    },
    notes: {
      order_id: orderData.order_id,
    },
    theme: {
      color: '#667eea',
    },
    modal: {
      ondismiss: function () {
        // Payment cancelled by user
        onFailure('Payment cancelled by user');
      },
    },
  };

  const paymentObject = new window.Razorpay(options);
  paymentObject.open();
};

// Process Razorpay payment for an order
export const processRazorpayPayment = async (
  orderId,
  userDetails,
  createRazorpayOrderFn,
  verifyPaymentFn
) => {
  try {
    // Step 1: Create Razorpay order on backend
    const orderData = await createRazorpayOrderFn(orderId);

    // Add user details to order data
    orderData.user_name = userDetails.name;
    orderData.user_email = userDetails.email;
    orderData.user_phone = userDetails.phone;

    // Step 2: Initialize Razorpay payment
    return new Promise((resolve, reject) => {
      initializeRazorpayPayment(
        orderData,
        async (paymentResponse) => {
          try {
            // Step 3: Verify payment on backend
            const verificationResult = await verifyPaymentFn(orderId, paymentResponse);
            resolve(verificationResult);
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          reject(new Error(error));
        }
      );
    });
  } catch (error) {
    throw error;
  }
};

// Process Razorpay payment for multiple orders
export const processCartRazorpayPayment = async (
  orderIds,
  userDetails,
  createCartRazorpayOrderFn,
  verifyCartPaymentFn
) => {
  try {
    const orderData = await createCartRazorpayOrderFn(orderIds);

    orderData.user_name = userDetails.name;
    orderData.user_email = userDetails.email;
    orderData.user_phone = userDetails.phone;
    orderData.order_id = orderData.receipt || "CART";

    return new Promise((resolve, reject) => {
      initializeRazorpayPayment(
        orderData,
        async (paymentResponse) => {
          try {
            const verificationResult = await verifyCartPaymentFn(orderIds, paymentResponse);
            resolve(verificationResult);
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          reject(new Error(error));
        }
      );
    });
  } catch (error) {
    throw error;
  }
};
