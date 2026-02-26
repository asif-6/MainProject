// API service for dashboard endpoints
const API_BASE_URL = "http://localhost:8000/api";

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem("authToken") || localStorage.getItem("token");
};

const getHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Token ${token}` }),
  };
};

// Pharmacy Dashboard API
export const fetchPharmacyDashboardData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/pharmacy-dashboard/`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch pharmacy dashboard data");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching pharmacy dashboard:", error);
    throw error;
  }
};

// Delivery Dashboard API
export const fetchDeliveryDashboardData = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error("No authentication token found. Please login first.");
    }
    
    const response = await fetch(`${API_BASE_URL}/delivery-dashboard/`, {
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Could not parse error response
      }
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching delivery dashboard:", error);
    throw error;
  }
};

// Get Pharmacies
export const fetchPharmacies = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/pharmacies/`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch pharmacies");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching pharmacies:", error);
    throw error;
  }
};

// Get Medicines
export const fetchMedicines = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/medicines/`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch medicines");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching medicines:", error);
    throw error;
  }
};

// Get Orders
export const fetchOrders = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/orders/`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch orders");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
};

// Get Deliveries
export const fetchDeliveries = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/deliveries/`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch deliveries");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching deliveries:", error);
    throw error;
  }
};

// Update Order Status
export const updateOrderStatus = async (orderId, status) => {
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      throw new Error("Failed to update order");
    }
    return await response.json();
  } catch (error) {
    console.error("Error updating order:", error);
    throw error;
  }
};

// Update Delivery Status
export const updateDeliveryStatus = async (deliveryId, status) => {
  try {
    const response = await fetch(`${API_BASE_URL}/deliveries/${deliveryId}/`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      throw new Error("Failed to update delivery");
    }
    return await response.json();
  } catch (error) {
    console.error("Error updating delivery:", error);
    throw error;
  }
};

// Order APIs
export const createOrder = async (orderData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/create-order/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(orderData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create order");
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
};

export const processPayment = async (orderId, paymentData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/process-payment/${orderId}/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(paymentData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Payment failed");
    }
    return await response.json();
  } catch (error) {
    console.error("Error processing payment:", error);
    throw error;
  }
};

// Razorpay Payment APIs
export const createRazorpayOrder = async (orderId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/create-razorpay-order/${orderId}/`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create Razorpay order");
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw error;
  }
};

export const verifyRazorpayPayment = async (orderId, paymentData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/verify-razorpay-payment/${orderId}/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(paymentData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Payment verification failed");
    }
    return await response.json();
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    throw error;
  }
};

export const getUserOrders = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/user-orders/`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error("Failed to fetch orders");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching user orders:", error);
    throw error;
  }
};

export const getPharmacyOrders = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/pharmacy-orders/`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error("Failed to fetch pharmacy orders");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching pharmacy orders:", error);
    throw error;
  }
};

export const getDeliveryOrders = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/delivery-orders/`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error("Failed to fetch delivery orders");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching delivery orders:", error);
    throw error;
  }
};

export const pharmacyAcceptOrder = async (orderId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/pharmacy-accept-order/${orderId}/`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to accept order");
    }
    return await response.json();
  } catch (error) {
    console.error("Error accepting order:", error);
    throw error;
  }
};

export const pharmacyRejectOrder = async (orderId, reason) => {
  try {
    const response = await fetch(`${API_BASE_URL}/pharmacy-reject-order/${orderId}/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to reject order");
    }
    return await response.json();
  } catch (error) {
    console.error("Error rejecting order:", error);
    throw error;
  }
};

export const deliveryAcceptOrder = async (orderId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/delivery-accept-order/${orderId}/`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to accept delivery");
    }
    return await response.json();
  } catch (error) {
    console.error("Error accepting delivery:", error);
    throw error;
  }
};

export const deliveryRejectOrder = async (orderId, reason) => {
  try {
    const response = await fetch(`${API_BASE_URL}/delivery-reject-order/${orderId}/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to reject delivery");
    }
    return await response.json();
  } catch (error) {
    console.error("Error rejecting delivery:", error);
    throw error;
  }
};

export const markDeliveryComplete = async (orderId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/mark-delivery-complete/${orderId}/`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to complete delivery");
    }
    return await response.json();
  } catch (error) {
    console.error("Error completing delivery:", error);
    throw error;
  }
};

export const generateDeliveryOTP = async (orderId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-delivery-otp/${orderId}/`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate OTP");
    }
    return await response.json();
  } catch (error) {
    console.error("Error generating OTP:", error);
    throw error;
  }
};

export const verifyDeliveryOTP = async (orderId, otp) => {
  try {
    const response = await fetch(`${API_BASE_URL}/verify-delivery-otp/${orderId}/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ otp })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to verify OTP");
    }
    return await response.json();
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
};

export const assignDeliveryPartner = async (deliveryId, data) => {
  try {
    const response = await fetch(`${API_BASE_URL}/deliveries/${deliveryId}/`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to assign delivery partner");
    }
    return await response.json();
  } catch (error) {
    console.error("Error assigning delivery partner:", error);
    throw error;
  }
};
// Delivery Notification APIs
export const getPendingDeliveryOrders = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/pending-delivery-orders/`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error("Failed to fetch pending delivery orders");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching pending delivery orders:", error);
    throw error;
  }
};

export const getDeliveryNotifications = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/delivery-notifications/`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error("Failed to fetch notifications");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching delivery notifications:", error);
    throw error;
  }
};

export const getUserNotifications = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/user-notifications/`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error("Failed to fetch user notifications");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    throw error;
  }
};

export const acceptDeliveryOrder = async (orderId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/accept-delivery-order/${orderId}/`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to accept delivery order");
    }
    return await response.json();
  } catch (error) {
    console.error("Error accepting delivery order:", error);
    throw error;
  }
};

export const markNotificationRead = async (notificationId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/mark-notification-read/${notificationId}/`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error("Failed to mark notification as read");
    }
    return await response.json();
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

export const createCartRazorpayOrder = async (orderIds) => {
  try {
    const response = await fetch(`${API_BASE_URL}/cart/create-razorpay-order/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ order_ids: orderIds })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create cart Razorpay order");
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating cart Razorpay order:", error);
    throw error;
  }
};

export const verifyCartRazorpayPayment = async (orderIds, paymentData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/cart/verify-razorpay-payment/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ order_ids: orderIds, ...paymentData })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Payment verification failed");
    }
    return await response.json();
  } catch (error) {
    console.error("Error verifying cart Razorpay payment:", error);
    throw error;
  }
};