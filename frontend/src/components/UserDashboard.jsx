import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { processRazorpayPayment, processCartRazorpayPayment } from "../services/razorpayService";
import { createRazorpayOrder, verifyRazorpayPayment, createCartRazorpayOrder, verifyCartRazorpayPayment } from "../services/dashboardApi";

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

export default function UserDashboard() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  // Ordering workflow state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartDeliveryRequired, setCartDeliveryRequired] = useState(false);
  const [cartDeliveryAddress, setCartDeliveryAddress] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [userOrders, setUserOrders] = useState([]);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [savedMedicinesModalOpen, setSavedMedicinesModalOpen] = useState(false);
  const [savedMedicines, setSavedMedicines] = useState([]);
  const [pharmacyMedicines, setPharmacyMedicines] = useState([]);
  const [userNotifications, setUserNotifications] = useState([]);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [refundLoading, setRefundLoading] = useState({});
  const [refundSuccessModal, setRefundSuccessModal] = useState(null);
  const [notification, setNotification] = useState(null);

  // Fetch medicines and pharmacies on component mount
  useEffect(() => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch medicines
      const medicinesRes = await fetch(`${API_BASE_URL}/medicines/`, {
        headers: getHeaders(),
      });

      // Fetch pharmacies
      const pharmaciesRes = await fetch(`${API_BASE_URL}/pharmacies/`, {
        headers: getHeaders(),
      });

      if (!medicinesRes.ok || !pharmaciesRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const medicinesData = await medicinesRes.json();
      const pharmaciesData = await pharmaciesRes.json();

      // Transform medicines data
      const transformedMedicines = medicinesData.map((med) => ({
        id: med.id,
        name: med.name,
        generic_name: med.generic_name || "",
        dosage: med.dosage || "",
        available: true,
      }));

      // Transform pharmacies data
      const transformedPharmacies = pharmaciesData.map((pharm) => ({
        id: pharm.id,
        name: pharm.name,
        location: pharm.address,
        phone: pharm.phone,
        stock: pharm.is_verified ? "Available" : "Pending Verification",
        medicines: Array.isArray(pharm.medicines) ? pharm.medicines : [],
      }));

      setMedicines(transformedMedicines);
      setPharmacies(transformedPharmacies);

      // Create combined list: pharmacy medicines with pharmacy info
      const combined = [];
      transformedPharmacies.forEach(pharmacy => {
        if (Array.isArray(pharmacy.medicines)) {
          pharmacy.medicines.forEach(pm => {
            combined.push({
              id: `${pm.id}-${pharmacy.id}`,
              medicineId: pm.medicine?.id || pm.id,
              medicineName: pm.medicine?.name || "",
              dosage: pm.medicine?.dosage || "",
              price: pm.price,
              stock: pm.stock,
              status: pm.status,
              pharmacyId: pharmacy.id,
              pharmacyName: pharmacy.name,
              pharmacyLocation: pharmacy.location,
              originalPharmacyMedicine: pm
            });
          });
        }
      });

      setPharmacyMedicines(combined);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("email");
    navigate("/login");
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleRefresh = () => {
    loadData();
    loadUserOrders();
    loadUserNotifications();
  };

  const viewProfile = async () => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      const res = await fetch(`${API_BASE_URL}/profile/`, { headers: getHeaders() });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || "Failed to fetch profile");
      }
      const data = await res.json();
      setProfileData(data);
      setProfileOpen(true);
    } catch (err) {
      console.error("Profile error:", err);
      setProfileError(err.message || "Error fetching profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const getUserDetails = () => {
    return {
      name: profileData?.full_name || "User",
      email: profileData?.email || localStorage.getItem("email") || "user@example.com",
      phone: profileData?.phone || "9999999999",
    };
  };

  // Ordering workflow functions
  const openOrderModal = (medicine, pharmacy) => {
    setSelectedMedicine(medicine);
    setSelectedPharmacy(pharmacy);
    setOrderModalOpen(true);
  };

  const createOrder = async () => {
    if (!selectedMedicine || !selectedPharmacy) return;

    setOrderLoading(true);
    try {
      const orderData = {
        medicine_id: selectedMedicine.id,
        pharmacy_id: selectedPharmacy.id,
        quantity: orderQuantity,
        delivery_required: deliveryRequired,
        delivery_address: deliveryAddress
      };

      const response = await fetch(`${API_BASE_URL}/create-order/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const order = await response.json();
      setCurrentOrder(order);
      setOrderModalOpen(false);
      setPaymentModalOpen(true);
    } catch (err) {
      console.error("Order creation error:", err);
      showNotification('Error creating order: ' + err.message, 'error');
    } finally {
      setOrderLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!currentOrder) return;

    setOrderLoading(true);
    try {
      // Razorpay payment flow (only method)
      console.log("🔵 Initiating Razorpay payment for order:", currentOrder.order_id);

      const userDetails = getUserDetails();

      console.log("🔵 User details:", userDetails);

      const result = await processRazorpayPayment(
        currentOrder.order_id,
        userDetails,
        createRazorpayOrder,
        verifyRazorpayPayment
      );

      console.log("Razorpay payment successful:", result);
      showNotification('Payment successful! Order placed.', 'success');
      setPaymentModalOpen(false);
      setCurrentOrder(null);
      loadUserOrders();
    } catch (err) {
      console.error("Payment error:", err);
      showNotification('Payment failed: ' + err.message, 'error');
    } finally {
      setOrderLoading(false);
    }
  };

  const addToCart = (medicine, pharmacy) => {
    if (!pharmacy) {
      showNotification('No pharmacies available. Please try again later.', 'error');
      return;
    }

    const pharmacyMedicine = pharmacy.medicines?.find(
      (pm) => pm?.medicine?.id === medicine.id
    );
    const price = pharmacyMedicine ? parseFloat(pharmacyMedicine.price) : 0;

    setCartItems((prev) => {
      const existing = prev.find((item) => item.medicine.id === medicine.id);
      if (existing) {
        return prev.map((item) =>
          item.medicine.id === medicine.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { medicine, pharmacy, quantity: 1, price }];
    });
    setCartOpen(true);
  };

  const updateCartQuantity = (medicineId, quantity) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.medicine.id === medicineId
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      )
    );
  };

  const removeFromCart = (medicineId) => {
    setCartItems((prev) => prev.filter((item) => item.medicine.id !== medicineId));
  };

  const clearCart = () => {
    setCartItems([]);
    setCartDeliveryRequired(false);
    setCartDeliveryAddress("");
  };

  const checkoutCart = async () => {
    if (cartItems.length === 0) return;
    if (cartDeliveryRequired && !cartDeliveryAddress.trim()) {
      showNotification('Please enter a delivery address.', 'error');
      return;
    }

    setCheckoutLoading(true);
    try {
      const createdOrders = [];
      const sharedOrderId = `ORD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

      for (const item of cartItems) {
        const orderData = {
          medicine_id: item.medicine.id,
          pharmacy_id: item.pharmacy.id,
          quantity: item.quantity,
          delivery_required: cartDeliveryRequired,
          delivery_address: cartDeliveryAddress,
          order_id: sharedOrderId,
        };

        const response = await fetch(`${API_BASE_URL}/create-order/`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(orderData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create order");
        }

        const order = await response.json();
        createdOrders.push(order);
      }

      const orderIds = [...new Set(createdOrders.map((order) => order.order_id))];
      const userDetails = getUserDetails();
      console.log("🔵 Initiating Razorpay payment for cart:", orderIds);
      await processCartRazorpayPayment(
        orderIds,
        userDetails,
        createCartRazorpayOrder,
        verifyCartRazorpayPayment
      );
      console.log("✅ Razorpay payment successful for cart:", orderIds);

      showNotification('Payment successful! Orders placed.', 'success');
      clearCart();
      setCartOpen(false);
      loadUserOrders();
    } catch (err) {
      console.error("Cart checkout error:", err);
      showNotification('Checkout failed: ' + err.message, 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getCartTotal = () => {
    return cartItems.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
      0
    );
  };

  const loadUserOrders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/user-orders/`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to load orders');
      }

      const orders = await response.json();
      setUserOrders(orders);
    } catch (err) {
      console.error("Error loading orders:", err);
    }
  };

  // Load orders and saved medicines on component mount
  useEffect(() => {
    loadUserOrders();
    loadSavedMedicines();
    loadUserNotifications();
  }, []);

  // Auto-refresh notifications every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadUserNotifications();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  const loadSavedMedicines = () => {
    const saved = localStorage.getItem('savedMedicines');
    if (saved) {
      try {
        setSavedMedicines(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved medicines:', e);
        setSavedMedicines([]);
      }
    }
  };

  const loadUserNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/user-notifications/`, {
        headers: getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setUserNotifications(data);
      }
    } catch (error) {
      console.error('Error loading user notifications:', error);
    }
  };

  const markNotificationsAsRead = async () => {
    try {
      const unreadIds = userNotifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length === 0) return;

      const response = await fetch(`${API_BASE_URL}/mark-notifications-read/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ notification_ids: unreadIds })
      });

      if (response.ok) {
        // Update local state to reflect read status
        setUserNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // Helper function to delete notification(s)
  const deleteNotification = async (notificationIds) => {
    try {
      const idsArray = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
      
      if (idsArray.length === 1) {
        // Delete single notification
        await fetch(`${API_BASE_URL}/delete-notification/${idsArray[0]}/`, {
          method: 'DELETE',
          headers: getHeaders(),
        });
      } else {
        // Delete multiple notifications
        await fetch(`${API_BASE_URL}/delete-notifications/`, {
          method: 'DELETE',
          headers: getHeaders(),
          body: JSON.stringify({ notification_ids: idsArray })
        });
      }

      // Remove from local state
      setUserNotifications(prev => prev.filter(n => !idsArray.includes(n.id)));
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  };

  // Auto-cleanup old notifications (24+ hours) and specific notification types
  useEffect(() => {
    if (userNotifications.length === 0) return;

    const now = new Date();
    const toDelete = [];

    userNotifications.forEach((notification) => {
      // Delete OTP notifications older than 2 hours
      if (notification.notification_type === 'delivery_otp') {
        const createdAt = new Date(notification.created_at);
        const hoursOld = (now - createdAt) / (1000 * 60 * 60);
        if (hoursOld > 2) {
          toDelete.push(notification.id);
        }
      }

      // Delete refund request notifications older than 1 hour (after they're acted upon)
      if (notification.notification_type === 'order_status' && 
          (notification.title.includes('Refund') || notification.message.includes('refund'))) {
        const createdAt = new Date(notification.created_at);
        const hoursOld = (now - createdAt) / (1000 * 60 * 60);
        if (hoursOld > 1) {
          toDelete.push(notification.id);
        }
      }

      // Delete old delivered notifications (24+ hours)
      if (notification.title && notification.title.includes('Delivered')) {
        const createdAt = new Date(notification.created_at);
        const hoursOld = (now - createdAt) / (1000 * 60 * 60);
        if (hoursOld > 24) {
          toDelete.push(notification.id);
        }
      }
    });

    if (toDelete.length > 0) {
      deleteNotification(toDelete);
    }
  }, [userNotifications]);

  const toggleSaveMedicine = (medicine) => {
    setSavedMedicines((prev) => {
      const isAlreadySaved = prev.some((m) => m.id === medicine.id);
      let updated;
      if (isAlreadySaved) {
        updated = prev.filter((m) => m.id !== medicine.id);
      } else {
        updated = [...prev, medicine];
      }
      localStorage.setItem('savedMedicines', JSON.stringify(updated));
      return updated;
    });
  };

  const isMedicineSaved = (medicineId) => {
    return savedMedicines.some((m) => m.id === medicineId);
  };

  const requestRefund = async (orderId) => {
    const reason = prompt("Enter reason for refund (e.g., pharmacy rejected order):");
    if (!reason || !reason.trim()) {
      showNotification('Reason is required', 'error');
      return;
    }

    setRefundLoading((prev) => ({ ...prev, [orderId]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/refund/${orderId}/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const responseText = await response.text();
      let result = null;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        result = {};
      }

      if (!response.ok) {
        const serverMessage = result.error || result.message;
        const fallback = responseText && !responseText.trim().startsWith("<!DOCTYPE")
          ? responseText
          : `Refund request failed (HTTP ${response.status})`;
        throw new Error(serverMessage || fallback);
      }

      const completionDate = new Date(new Date(result.refund_initiated_at).getTime() + 3 * 24 * 60 * 60 * 1000);
      setRefundSuccessModal({
        orderId: orderId,
        amount: result.refund_amount,
        initiatedDate: new Date(result.refund_initiated_at).toLocaleDateString(),
        completionDate: completionDate.toLocaleDateString()
      });
      
      // Delete refund-related notifications for this order
      const refundNotifications = userNotifications.filter(
        n => n.order_id === parseInt(orderId) && 
             (n.notification_type === 'order_status' || 
              n.title.includes('Refund') || 
              n.message.includes('refund'))
      );
      if (refundNotifications.length > 0) {
        deleteNotification(refundNotifications.map(n => n.id));
      }
      
      // Auto-close modal after 5 seconds and refresh orders
      setTimeout(() => {
        setRefundSuccessModal(null);
        loadUserOrders();
      }, 5000);
    } catch (err) {
      console.error("Refund error:", err);
      showNotification('Refund request failed: ' + err.message, 'error');
    } finally {
      setRefundLoading((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Quick action handlers
  const handleSavedMedicines = () => {
    setSavedMedicinesModalOpen(true);
  };

  // Filter pharmacy medicines based on search
  const filteredPharmacyMedicines = pharmacyMedicines.filter((pm) => {
    const matchName =
      pm.medicineName.toLowerCase().includes(searchText.toLowerCase()) ||
      pm.dosage.toLowerCase().includes(searchText.toLowerCase()) ||
      pm.pharmacyName.toLowerCase().includes(searchText.toLowerCase());
    return matchName;
  });

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingSpinner}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={{ color: "red", padding: "20px" }}>Error: {error}</div>
        <button onClick={loadData} style={styles.retryBtn}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '16px 24px',
          background: notification.type === 'success' ? '#10b981' : notification.type === 'error' ? '#ef4444' : '#3b82f6',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          zIndex: 2000,
          fontSize: '0.95rem',
          fontWeight: '500',
          animation: 'slideIn 0.3s ease-out',
          maxWidth: '400px'
        }}>
          {notification.message}
        </div>
      )}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <video style={styles.backgroundVideo} autoPlay muted loop playsInline>
        <source src="/your-video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div style={styles.backgroundOverlay}></div>

      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div>
              <h1 style={styles.headerTitle}>Medicine Dashboard</h1>
              <p style={styles.headerSubtitle}>
                Search medicines and find availability in nearby pharmacies
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                style={{ ...styles.profileBtn, background: "rgba(255, 255, 255, 0.2)", color: "#0f172a" }}
                onClick={() => setCartOpen(true)}
              >
                Cart ({cartItems.length})
              </button>
              <button
                style={{ 
                  ...styles.profileBtn, 
                  background: userNotifications.filter(n => !n.is_read).length > 0 
                    ? "rgba(239, 68, 68, 0.3)" 
                    : "rgba(255, 255, 255, 0.2)", 
                  color: "#0f172a",
                  position: "relative"
                }}
                onClick={() => {
                  setOtpModalOpen(true);
                  // Mark notifications as read when opening modal
                  setTimeout(() => markNotificationsAsRead(), 500);
                }}
              >
                Notifications
                {userNotifications.filter(n => !n.is_read).length > 0 && (
                  <span style={{
                    position: "absolute",
                    top: "-5px",
                    right: "-5px",
                    background: "#ef4444",
                    color: "white",
                    borderRadius: "50%",
                    width: "22px",
                    height: "22px",
                    fontSize: "0.7rem",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid white"
                  }}>
                    {userNotifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>
              <button style={{ ...styles.profileBtn, background: "rgba(16, 185, 129, 0.3)", color: "#0f172a" }} onClick={handleRefresh} title="Refresh medicines and notifications">
                Refresh
              </button>
              <button style={styles.profileBtn} onClick={viewProfile} disabled={profileLoading}>
                <svg style={styles.profileIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {profileLoading ? "Loading..." : "My Profile"}
              </button>
              <button style={{ ...styles.profileBtn, background: "#ef4444", color: "white" }} onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        </header>

        <div style={styles.searchCard}>
          <div style={styles.searchRow}>
            <div style={styles.searchInputWrapper}>
              <svg style={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search medicine (e.g., Insulin, Paracetamol)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <button style={styles.searchBtn} onClick={loadData}>
              Refresh
            </button>
          </div>
        </div>

        {/* Quick Actions Section - Moved to Top */}
        <section style={styles.actionsSection}>
          <h2 style={styles.actionsTitle}>Quick Actions</h2>
          <div style={styles.actionGrid}>
            <button style={styles.actionCard} onClick={() => setCartOpen(true)}>
              <div style={styles.actionContent}>
                <h3 style={styles.actionCardTitle}>View Cart</h3>
                <p style={styles.actionCardText}>Checkout multiple items</p>
              </div>
            </button>
            <button style={styles.actionCard} onClick={handleSavedMedicines}>
              <div style={styles.actionContent}>
                <h3 style={styles.actionCardTitle}>Saved Medicines</h3>
                <p style={styles.actionCardText}>View your favorites ({savedMedicines.length})</p>
              </div>
            </button>
            <button style={styles.actionCard} onClick={() => setOrdersModalOpen(true)}>
              <div style={styles.actionContent}>
                <h3 style={styles.actionCardTitle}>My Orders</h3>
                <p style={styles.actionCardText}>Track your orders</p>
              </div>
            </button>
          </div>
        </section>

        <div style={styles.mainGrid}>
          <section style={styles.panel} data-section="medicines">
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Available Medicines</h2>
              <span style={styles.badge}>{filteredPharmacyMedicines.length} items</span>
            </div>
            <div style={styles.list}>
              {filteredPharmacyMedicines.length === 0 ? (
                <div style={styles.emptyState}>
                  <p style={styles.emptyText}>No medicines found in any pharmacy</p>
                </div>
              ) : (
                filteredPharmacyMedicines.map((pm) => {
                  const isSaved = savedMedicines.some(s => s.id === pm.medicineId);
                  return (
                    <div key={pm.id} style={styles.medicineProfessional}>
                      <div style={styles.medicineMainContent}>
                        <div style={styles.medicineTitleSection}>
                          <h3 style={styles.medicineTitleBold}>
                            {pm.medicineName}
                            {pm.dosage && <span style={{fontSize: "0.8em", color: "rgba(255,255,255,0.8)"}}> {pm.dosage}</span>}
                          </h3>
                          <p style={styles.medicineShop}>Shop: {pm.pharmacyName}</p>
                        </div>
                        <div style={styles.medicineDetailsRow}>
                          <div style={styles.priceSection}>
                            <span style={styles.priceLabel}>Price</span>
                            <span style={styles.priceValue}>₹{Number(pm.price).toFixed(2)}</span>
                          </div>
                          <div style={styles.stockSection}>
                            <span style={{...styles.categoryBadge, background: pm.status === "in_stock" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)", color: pm.status === "in_stock" ? "#86efac" : "#fca5a5"}}>
                              {pm.status === "in_stock" ? "In Stock" : pm.status === "low_stock" ? "Low Stock" : "Out of Stock"}
                            </span>
                            <span style={{fontSize: "0.75rem", color: "rgba(255,255,255,0.6)"}}>({pm.stock} units)</span>
                          </div>
                        </div>
                      </div>
                      <div style={styles.medicineActions}>
                        <button
                          style={{
                            padding: "8px 12px",
                            background: isSaved ? "#ef4444" : "transparent",
                            border: "2px solid #ef4444",
                            borderRadius: "8px",
                            fontSize: "1.2rem",
                            cursor: "pointer",
                            transition: "all 0.3s ease"
                          }}
                          onClick={() => toggleSaveMedicine({id: pm.medicineId, name: pm.medicineName, dosage: pm.dosage})}
                          title={isSaved ? "Remove from saved" : "Save medicine"}
                        >
                          {isSaved ? "♥" : "♡"}
                        </button>
                        <button
                          style={{ ...styles.searchBtn, padding: "8px 16px", fontSize: "0.8rem" }}
                          onClick={() => {
                            const pharmacy = pharmacies.find(p => p.id === pm.pharmacyId);
                            const medicine = {id: pm.medicineId, name: pm.medicineName, dosage: pm.dosage};
                            if (pharmacy) {
                              openOrderModal(medicine, pharmacy);
                            }
                          }}
                        >
                          Buy Now
                        </button>
                        <button
                          style={{ ...styles.searchBtn, padding: "8px 16px", fontSize: "0.8rem", background: "#0ea5e9" }}
                          onClick={() => {
                            const pharmacy = pharmacies.find(p => p.id === pm.pharmacyId);
                            const medicine = {id: pm.medicineId, name: pm.medicineName, dosage: pm.dosage};
                            if (pharmacy) {
                              addToCart(medicine, pharmacy);
                            }
                          }}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Registered Pharmacies</h2>
              <span style={styles.badge}>{pharmacies.length} locations</span>
            </div>
            <div style={styles.list}>
              {pharmacies.length === 0 ? (
                <div style={styles.emptyState}>
                  <p style={styles.emptyText}>No pharmacies registered</p>
                </div>
              ) : (
                pharmacies.map((p) => (
                  <div key={p.id} style={styles.pharmacyItem}>
                    <div style={styles.pharmacyIcon}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={styles.iconSvg}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div style={styles.itemContent}>
                      <h3 style={styles.itemTitle}>{p.name}</h3>
                      <div style={styles.pharmacyDetails}>
                        <div style={styles.detailRow}>
                          <span style={styles.detailText}>{p.location}</span>
                        </div>
                        <div style={styles.detailRow}>
                          <span style={styles.detailText}>{p.phone}</span>
                        </div>
                      </div>
                    </div>
                    <span style={styles.statusAvailable}>{p.stock}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
      {profileOpen && (
        <div style={styles.modalOverlay} onClick={() => setProfileOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>My Profile</h3>
            {profileError && <p style={{ color: "red" }}>{profileError}</p>}
            {!profileData ? (
              <p>Loading...</p>
            ) : (
              <div>
                <p><strong>Full name:</strong> {profileData.full_name || "-"}</p>
                <p><strong>Email:</strong> {profileData.email}</p>
                <p><strong>Role:</strong> {profileData.role}</p>
              </div>
            )}
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={styles.searchBtn} onClick={() => setProfileOpen(false)}>Close</button>
              <button style={{ ...styles.searchBtn, background: "#ef4444" }} onClick={logout}>Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {cartOpen && (
        <div style={styles.modalOverlay} onClick={() => setCartOpen(false)}>
          <div style={{ ...styles.modal, maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>🛒 Your Cart</h3>
            {cartItems.length === 0 ? (
              <p>Your cart is empty.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {cartItems.map((item) => (
                  <div key={item.medicine.id} style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div>
                        <strong>{item.medicine.name}</strong>
                        {item.medicine.dosage && <span style={{ marginLeft: 8, color: "#64748b" }}>{item.medicine.dosage}</span>}
                      </div>
                      <button
                        style={{ ...styles.searchBtn, padding: "6px 12px", background: "#ef4444" }}
                        onClick={() => removeFromCart(item.medicine.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#475569" }}>Price</span>
                      <strong>₹{Number(item.price || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <label style={{ fontWeight: 600 }}>Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateCartQuantity(item.medicine.id, parseInt(e.target.value) || 1)}
                        style={{ width: "80px", padding: "6px", border: "1px solid #ccc", borderRadius: "6px" }}
                      />
                      <span style={{ marginLeft: "auto", fontWeight: 700 }}>
                        Subtotal: ₹{(Number(item.price || 0) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cartItems.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700 }}>Cart Total</span>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>₹{getCartTotal().toFixed(2)}</span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={cartDeliveryRequired}
                    onChange={(e) => setCartDeliveryRequired(e.target.checked)}
                  />
                  Need Delivery for all items?
                </label>
                {cartDeliveryRequired && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Delivery Address</label>
                    <textarea
                      value={cartDeliveryAddress}
                      onChange={(e) => setCartDeliveryAddress(e.target.value)}
                      placeholder="Enter delivery address"
                      style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", minHeight: "60px" }}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={styles.searchBtn} onClick={() => setCartOpen(false)}>Close</button>
              {cartItems.length > 0 && (
                <button
                  style={{ ...styles.searchBtn, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                  onClick={checkoutCart}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? "Processing..." : "Checkout & Pay"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OTP Notification Modal */}
      {otpModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setOtpModalOpen(false)}>
          <div style={{ ...styles.modal, maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              Delivery Notifications
            </h3>
            
            {userNotifications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b" }}>
                <p style={{ fontSize: "1.1rem" }}>No notifications yet</p>
                <p style={{ fontSize: "0.9rem" }}>Your delivery OTPs will appear here</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "400px", overflowY: "auto" }}>
                {userNotifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    style={{ 
                      padding: "20px", 
                      border: notification.is_read ? "1px solid #e2e8f0" : "2px solid #3b82f6", 
                      borderRadius: "12px",
                      background: notification.is_read ? "#f8fafc" : "#eff6ff",
                      position: "relative"
                    }}
                  >
                    {!notification.is_read && (
                      <span style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        background: "#3b82f6",
                        color: "white",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.7rem",
                        fontWeight: "bold"
                      }}>
                        NEW
                      </span>
                    )}
                    
                    <div style={{ marginBottom: "12px" }}>
                      <h4 style={{ margin: "0 0 4px 0", color: "#1e293b", fontSize: "1rem" }}>
                        {notification.title}
                      </h4>
                      <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "0.85rem" }}>
                        Order #{notification.order_id}
                      </p>
                      <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                        {notification.message}
                      </p>
                    </div>

                    {notification.otp && notification.notification_type === 'delivery_otp' && (
                      <div style={{
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        padding: "24px",
                        borderRadius: "12px",
                        textAlign: "center",
                        marginTop: "16px"
                      }}>
                        <p style={{ 
                          margin: "0 0 8px 0", 
                          color: "white", 
                          fontSize: "0.85rem", 
                          fontWeight: "600",
                          textTransform: "uppercase",
                          letterSpacing: "1px"
                        }}>
                          Your OTP Code
                        </p>
                        <p style={{ 
                          margin: 0, 
                          fontSize: "2.5rem", 
                          fontWeight: "bold", 
                          color: "white",
                          letterSpacing: "8px",
                          fontFamily: "monospace"
                        }}>
                          {notification.otp}
                        </p>
                        <p style={{ 
                          margin: "12px 0 0 0", 
                          color: "rgba(255, 255, 255, 0.9)", 
                          fontSize: "0.8rem"
                        }}>
                          📢 Tell this code to your delivery partner
                        </p>
                      </div>
                    )}

                    <div style={{ 
                      marginTop: "12px", 
                      paddingTop: "12px", 
                      borderTop: "1px solid #e2e8f0",
                      color: "#94a3b8",
                      fontSize: "0.75rem"
                    }}>
                      {new Date(notification.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button 
                style={styles.searchBtn} 
                onClick={() => {
                  // Delete OTP notifications when closing the modal
                  const otpNotifications = userNotifications.filter(
                    n => n.notification_type === 'delivery_otp'
                  );
                  if (otpNotifications.length > 0) {
                    deleteNotification(otpNotifications.map(n => n.id));
                  }
                  setOtpModalOpen(false);
                  loadUserNotifications();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {orderModalOpen && selectedMedicine && (
        <div style={styles.modalOverlay} onClick={() => setOrderModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Order Medicine</h3>
            <div style={{ marginBottom: 16 }}>
              <p><strong>Medicine:</strong> {selectedMedicine.name}</p>
              <p><strong>Pharmacy:</strong> {selectedPharmacy?.name}</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Quantity</label>
              <input
                type="number"
                min="1"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={deliveryRequired}
                  onChange={(e) => setDeliveryRequired(e.target.checked)}
                />
                Need Delivery?
              </label>
            </div>
            {deliveryRequired && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Delivery Address</label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter delivery address"
                  style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", minHeight: "60px" }}
                />
              </div>
            )}
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={styles.searchBtn} onClick={() => setOrderModalOpen(false)}>Cancel</button>
              <button
                style={{ ...styles.searchBtn, background: "#10b981" }}
                onClick={createOrder}
                disabled={orderLoading || (deliveryRequired && !deliveryAddress.trim())}
              >
                {orderLoading ? "Creating..." : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && currentOrder && (
        <div style={styles.modalOverlay} onClick={() => setPaymentModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>💳 Complete Payment</h3>
            <div style={{ marginBottom: 16, padding: "12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" }}>
              <p style={{ margin: "4px 0" }}><strong>Order ID:</strong> {currentOrder.order_id}</p>
              <p style={{ margin: "4px 0" }}><strong>Medicine:</strong> {currentOrder.medicine_name}</p>
              <p style={{ margin: "4px 0", fontSize: "1.2rem", color: "#0369a1" }}><strong>Total Amount:</strong> ₹{currentOrder.total_price}</p>
            </div>
            <div style={{ marginBottom: 16, padding: "12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #86efac" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#166534" }}>
                <strong>Secure Payment:</strong> You will be redirected to Razorpay's secure payment gateway. All major payment methods supported.
              </p>
            </div>
            <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={styles.searchBtn} onClick={() => setPaymentModalOpen(false)}>Cancel</button>
              <button
                style={{ ...styles.searchBtn, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: "12px 32px", fontWeight: "700" }}
                onClick={handlePayment}
                disabled={orderLoading}
              >
                {orderLoading ? "Processing..." : "Pay with Razorpay"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders History Modal */}
      {ordersModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setOrdersModalOpen(false)}>
          <div style={{...styles.modal, maxWidth: "700px", maxHeight: "80vh", overflowY: "auto"}} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>My Orders</h3>
            {userOrders.length === 0 ? (
              <p>No orders found.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {userOrders.map((order) => (
                  <div key={order.order_id || order.id} style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#fafbfc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0 }}>Order #{order.order_id}</h4>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        backgroundColor: order.order_status === 'delivered' ? '#dcfce7' : order.order_status === 'pending_pharmacy_confirmation' ? '#fef3c7' : order.order_status === 'pharmacy_rejected' ? '#fee2e2' : '#dbeafe',
                        color: order.order_status === 'delivered' ? '#166534' : order.order_status === 'pending_pharmacy_confirmation' ? '#92400e' : order.order_status === 'pharmacy_rejected' ? '#991b1b' : '#1e40af'
                      }}>
                        {order.order_status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    
                    {Array.isArray(order.medicines) && order.medicines.length > 0 ? (
                      <div style={{ margin: "12px 0" }}>
                        <p style={{ margin: "4px 0", fontSize: "0.9rem", fontWeight: 600, color: "#475569" }}>Medicines:</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
                          {order.medicines.map((med, index) => (
                            <div key={`${order.order_id}-${med.id || index}`} style={{ padding: "8px 10px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.9rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>{med.medicine_name}{med.medicine_dosage ? ` ${med.medicine_dosage}` : ""} × {med.quantity}</span>
                                <span style={{ fontWeight: 600 }}>₹{Number(med.price || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: "4px 0", fontSize: "0.9rem" }}><strong>Medicine:</strong> {order.medicine_name}</p>
                        <p style={{ margin: "4px 0", fontSize: "0.9rem" }}><strong>Quantity:</strong> {order.quantity}</p>
                      </>
                    )}
                    
                    <p style={{ margin: "8px 0", fontSize: "0.9rem", borderTop: "1px solid #e2e8f0", paddingTop: "8px" }}><strong>Total:</strong> ₹{Number(order.total_price).toFixed(2)}</p>
                    <p style={{ margin: "4px 0", fontSize: "0.9rem" }}><strong>Pharmacy:</strong> {order.pharmacy_name}</p>
                    {order.delivery_required && (
                      <p style={{ margin: "4px 0", fontSize: "0.9rem" }}><strong>Delivery Address:</strong> {order.delivery_address}</p>
                    )}
                    
                    {/* Refund Status Section */}
                    {order.payment && order.payment.refund_status && order.payment.refund_status !== 'no_refund' && (
                      <div style={{ marginTop: "16px", padding: "16px", background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)", borderRadius: "10px", border: "2px solid #06b6d4", boxShadow: "0 4px 12px rgba(6, 182, 212, 0.1)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                          <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0369a1", display: "flex", alignItems: "center", gap: "8px" }}>
                            💰 Refund in Progress
                          </h4>
                          <span style={{ padding: "6px 12px", background: "#cffafe", color: "#0369a1", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {order.payment.refund_status}
                          </span>
                        </div>

                        {/* Amount Section */}
                        {order.payment.refund_amount && (
                          <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid rgba(3, 105, 161, 0.2)" }}>
                            <p style={{ margin: 0, fontSize: "0.85rem", color: "#0369a1", fontWeight: 500 }}>Refund Amount</p>
                            <p style={{ margin: "4px 0 0 0", fontSize: "1.3rem", fontWeight: 700, color: "#0f766e" }}>₹{Number(order.payment.refund_amount).toFixed(2)}</p>
                          </div>
                        )}

                        {/* Timeline Section */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ fontSize: "1.2rem" }}>⏱️</div>
                          <div style={{ flex: 1 }}>
                            {order.payment.refund_status === 'completed' ? (
                              <>
                                <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: 600, color: "#10b981" }}>Refund Completed</p>
                                {order.payment.refund_completed_at && (
                                  <p style={{ margin: "0 0 4px 0", fontSize: "0.8rem", color: "#0369a1" }}>
                                    Completed on {new Date(order.payment.refund_completed_at).toLocaleDateString()}
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: 600, color: "#0369a1" }}>
                                  Expected in 3 days
                                </p>
                                {order.payment.refund_initiated_at && (
                                  <>
                                    <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", color: "#64748b" }}>
                                      Started: {new Date(order.payment.refund_initiated_at).toLocaleDateString()}
                                    </p>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
                                      Expected by: {new Date(new Date(order.payment.refund_initiated_at).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                    </p>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Refund Button - Show only for rejected orders without pending refunds */}
                    {(order.order_status === 'pharmacy_rejected' || order.order_status === 'cancelled') && 
                     (!order.payment || order.payment.refund_status === 'no_refund') && (
                      <div style={{ marginTop: "12px" }}>
                        <button
                          style={{ ...styles.searchBtn, background: "#f59e0b", width: "100%", padding: "8px" }}
                          onClick={() => requestRefund(order.order_id)}
                          disabled={refundLoading[order.order_id]}
                        >
                          {refundLoading[order.order_id] ? "Processing..." : "Request Refund"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button 
                style={styles.searchBtn} 
                onClick={() => {
                  // Delete old order status notifications (24+ hours)
                  const oldNotifications = userNotifications.filter(n => {
                    if (n.title && n.title.includes('Delivered')) {
                      const createdAt = new Date(n.created_at);
                      const hoursOld = (new Date() - createdAt) / (1000 * 60 * 60);
                      return hoursOld > 24;
                    }
                    return false;
                  });
                  if (oldNotifications.length > 0) {
                    deleteNotification(oldNotifications.map(n => n.id));
                  }
                  setOrdersModalOpen(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Medicines Modal */}
      {savedMedicinesModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setSavedMedicinesModalOpen(false)}>
          <div style={{ ...styles.modal, maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Saved Medicines</h3>
            {savedMedicines.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#374151" }}>No Saved Medicines</h4>
                <p style={{ margin: 0, color: "#6b7280" }}>
                  Save medicines for quick access later.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {savedMedicines.map((medicine) => (
                  <div key={medicine.id} style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#f9fafb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div>
                        <strong style={{ fontSize: "1.05rem" }}>{medicine.name}</strong>
                        {medicine.dosage && <span style={{ marginLeft: 8, color: "#64748b" }}>{medicine.dosage}</span>}
                      </div>
                      <button
                        style={{ ...styles.searchBtn, padding: "6px 12px", background: "#ef4444" }}
                        onClick={() => toggleSaveMedicine(medicine)}
                      >
                        Remove
                      </button>
                    </div>
                    {medicine.generic_name && (
                      <p style={{ margin: "4px 0", color: "#64748b", fontSize: "0.9rem" }}>
                        <strong>Generic:</strong> {medicine.generic_name}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <button
                        style={{ ...styles.searchBtn, padding: "8px 16px", fontSize: "0.85rem" }}
                        onClick={() => {
                          if (pharmacies.length > 0) {
                            openOrderModal(medicine, pharmacies[0]);
                            setSavedMedicinesModalOpen(false);
                          } else {
                            showNotification('No pharmacies available.', 'error');
                          }
                        }}
                      >
                        Buy Now
                      </button>
                      <button
                        style={{ ...styles.searchBtn, padding: "8px 16px", fontSize: "0.85rem", background: "#0ea5e9" }}
                        onClick={() => {
                          addToCart(medicine, pharmacies[0]);
                          setSavedMedicinesModalOpen(false);
                        }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button style={styles.searchBtn} onClick={() => setSavedMedicinesModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Success Modal */}
      {refundSuccessModal && (
        <div style={styles.modalOverlay} onClick={() => setRefundSuccessModal(null)}>
          <div style={{ ...styles.modal, maxWidth: "500px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>

            
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.5rem", fontWeight: 700, color: "#10b981" }}>
              Refund Initiated Successfully
            </h3>
            
            <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", padding: "20px", borderRadius: "12px", marginBottom: "20px", border: "2px solid #86efac" }}>
              <div style={{ marginBottom: "12px" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>Refund Amount</p>
                <p style={{ margin: 0, fontSize: "2rem", fontWeight: 700, color: "#059669" }}>₹{Number(refundSuccessModal.amount).toFixed(2)}</p>
              </div>
            </div>

            <div style={{ textAlign: "left", background: "#f8fafc", padding: "16px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.2rem" }}>📅</span>
                <div>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: 600, color: "#0369a1" }}>Processing Timeline</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Started: {refundSuccessModal.initiatedDate}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>Expected by: {refundSuccessModal.completionDate}</p>
                </div>
              </div>
            </div>

            <div style={{ background: "#fef08a", padding: "12px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #fcd34d" }}>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#78350f", fontWeight: 500 }}>⏱️ Refund will be processed within 3 business days</p>
            </div>

            <button
              style={{ ...styles.searchBtn, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", width: "100%", padding: "12px" }}
              onClick={() => setRefundSuccessModal(null)}
            >
              Got it, Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  pageWrapper: { position: "relative", minHeight: "100vh", overflow: "hidden" },
  backgroundVideo: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: -2 },
  backgroundOverlay: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "radial-gradient(1200px 600px at 15% 10%, rgba(215, 241, 236, 0.65) 0%, transparent 55%), radial-gradient(1000px 700px at 85% 15%, rgba(248, 234, 216, 0.6) 0%, transparent 60%), linear-gradient(160deg, rgba(247, 251, 250, 0.65) 0%, rgba(233, 242, 241, 0.65) 45%, rgba(247, 242, 234, 0.65) 100%)", zIndex: -1 },
  container: { position: "relative", minHeight: "100vh", padding: "24px", fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif", zIndex: 1, background: "transparent" },
  loadingSpinner: { textAlign: "center", padding: "60px 20px", fontSize: "1.1rem", color: "#ffffff" },
  retryBtn: { padding: "12px 24px", background: "linear-gradient(135deg, #0f766e 0%, #1aa091 100%)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", marginLeft: "20px", boxShadow: "0 4px 16px rgba(15, 118, 110, 0.35)" },
  header: { background: "linear-gradient(135deg, rgba(15, 118, 110, 0.22) 0%, rgba(247, 197, 159, 0.18) 100%)", backdropFilter: "blur(20px)", borderRadius: "20px", padding: "32px", marginBottom: "24px", boxShadow: "0 10px 34px rgba(10, 40, 45, 0.18)", border: "1px solid rgba(11, 31, 36, 0.12)" },
  headerContent: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" },
  headerTitle: { fontSize: "2rem", fontWeight: "700", color: "#ffffff", margin: "0 0 8px 0" },
  headerSubtitle: { fontSize: "1rem", color: "rgba(255, 255, 255, 0.9)", margin: 0 },
  profileBtn: { display: "flex", alignItems: "center", gap: "8px", padding: "12px 24px", background: "rgba(255, 255, 255, 0.15)", border: "2px solid rgba(255, 255, 255, 0.3)", borderRadius: "10px", fontSize: "0.95rem", fontWeight: "600", color: "#ffffff", cursor: "pointer", backdropFilter: "blur(10px)", transition: "all 0.3s ease" },
  profileIcon: { width: "20px", height: "20px" },
  searchCard: { background: "linear-gradient(135deg, rgba(15, 118, 110, 0.18) 0%, rgba(247, 197, 159, 0.14) 100%)", backdropFilter: "blur(20px)", borderRadius: "20px", padding: "28px", marginBottom: "24px", boxShadow: "0 10px 30px rgba(15, 118, 110, 0.18)", border: "1px solid rgba(11, 31, 36, 0.12)" },
  searchRow: { display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" },
  searchInputWrapper: { position: "relative", flex: 1, minWidth: "280px" },
  searchIcon: { position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", width: "20px", height: "20px", color: "#94a3b8" },
  searchInput: { width: "100%", padding: "14px 16px 14px 48px", border: "2px solid rgba(255, 255, 255, 0.3)", borderRadius: "10px", fontSize: "0.95rem", color: "#1e293b", background: "rgba(255, 255, 255, 0.9)", outline: "none", boxSizing: "border-box" },
  searchBtn: { padding: "14px 32px", background: "linear-gradient(135deg, #0f766e 0%, #1aa091 100%)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.95rem", fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 12px rgba(15, 118, 110, 0.25)" },
  mainGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "24px", marginBottom: "24px" },
  panel: { background: "linear-gradient(135deg, rgba(15, 118, 110, 0.18) 0%, rgba(247, 197, 159, 0.12) 100%)", backdropFilter: "blur(20px)", borderRadius: "20px", padding: "28px", boxShadow: "0 8px 30px rgba(15, 118, 110, 0.2)", border: "1px solid rgba(11, 31, 36, 0.12)" },
  medicineProfessional: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "16px",
    backdropFilter: "blur(10px)",
    transition: "all 0.3s ease",
    cursor: "pointer",
    gap: "16px",
    flexWrap: "wrap"
  },
  medicineMainContent: {
    flex: 1,
    minWidth: "280px"
  },
  medicineTitleSection: {
    marginBottom: "12px"
  },
  medicineTitleBold: {
    fontSize: "1.1rem",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 4px 0"
  },
  medicineShop: {
    fontSize: "0.9rem",
    color: "rgba(255, 255, 255, 0.75)",
    margin: "0",
    fontWeight: "500"
  },
  medicineDetailsRow: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap"
  },
  priceSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px"
  },
  priceLabel: {
    fontSize: "0.75rem",
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "600",
    textTransform: "uppercase"
  },
  priceValue: {
    fontSize: "1.3rem",
    fontWeight: "700",
    color: "#10b981"
  },
  stockSection: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap"
  },
  medicineActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap"
  },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  panelTitle: { fontSize: "1.3rem", fontWeight: "700", color: "#ffffff", margin: 0 },
  badge: { padding: "6px 14px", background: "rgba(255, 255, 255, 0.25)", color: "#ffffff", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "600", backdropFilter: "blur(10px)", border: "1px solid rgba(255, 255, 255, 0.3)" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  medicineItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "16px", backdropFilter: "blur(10px)", transition: "all 0.3s ease", cursor: "pointer" },
  pharmacyItem: { display: "flex", alignItems: "flex-start", gap: "16px", padding: "18px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "16px", backdropFilter: "blur(10px)", transition: "all 0.3s ease" },
  pharmacyIcon: { width: "48px", height: "48px", background: "linear-gradient(135deg, #0f766e 0%, #1aa091 100%)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconSvg: { width: "24px", height: "24px", color: "white" },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: "1.05rem", fontWeight: "600", color: "#ffffff", margin: "0 0 6px 0" },
  itemMeta: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  categoryBadge: { padding: "4px 10px", background: "rgba(15, 118, 110, 0.25)", color: "#d6f5f0", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "600", border: "1px solid rgba(214, 245, 240, 0.3)" },
  pharmacyDetails: { display: "flex", flexDirection: "column", gap: "6px" },
  detailRow: { display: "flex", alignItems: "center", gap: "8px" },
  detailText: { fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.8)" },
  statusAvailable: { padding: "6px 14px", background: "rgba(34, 197, 94, 0.25)", color: "#86efac", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap", border: "1px solid rgba(134, 239, 172, 0.4)" },
  emptyState: { textAlign: "center", padding: "48px 20px" },
  emptyText: { fontSize: "1rem", color: "#94a3b8", margin: 0 },
  actionsSection: { background: "linear-gradient(135deg, rgba(15, 118, 110, 0.16) 0%, rgba(247, 197, 159, 0.12) 100%)", backdropFilter: "blur(20px)", borderRadius: "20px", padding: "28px", boxShadow: "0 8px 28px rgba(15, 118, 110, 0.2)", border: "1px solid rgba(11, 31, 36, 0.12)" },
  actionsTitle: { fontSize: "1.3rem", fontWeight: "700", color: "#ffffff", margin: "0 0 20px 0" },
  actionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" },
  actionCard: { display: "flex", alignItems: "center", gap: "16px", padding: "20px", background: "rgba(255, 255, 255, 0.08)", border: "2px solid rgba(255, 255, 255, 0.15)", borderRadius: "16px", cursor: "pointer", textAlign: "left", backdropFilter: "blur(10px)", transition: "all 0.3s ease" },
  actionIconWrapper: { width: "48px", height: "48px", background: "linear-gradient(135deg, #0f766e 0%, #1aa091 100%)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "24px" },
  actionContent: { flex: 1 },
  actionCardTitle: { fontSize: "1rem", fontWeight: "600", color: "#ffffff", margin: "0 0 4px 0" },
  actionCardText: { fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.8)", margin: 0 },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modal: { background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)", color: "#0f172a", padding: "24px", borderRadius: "20px", width: "90%", maxWidth: "420px", boxShadow: "0 20px 60px rgba(15, 118, 110, 0.22)", border: "1px solid rgba(255, 255, 255, 0.5)", backdropFilter: "blur(20px)" },
};
