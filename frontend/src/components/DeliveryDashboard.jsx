import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/delivery-dashboard.css";
import { 
  fetchDeliveryDashboardData, 
  deliveryAcceptOrder, 
  deliveryRejectOrder, 
  markDeliveryComplete,
  getPendingDeliveryOrders,
  getDeliveryNotifications,
  acceptDeliveryOrder,
  markNotificationRead,
  generateDeliveryOTP,
  verifyDeliveryOTP
} from "../services/dashboardApi";

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("active"); // 'active' or 'pending'
  const [dashboardData, setDashboardData] = useState({
    stats: {},
    active_deliveries: [],
    metrics: {},
    driver_performance: [],
  });
  const [pendingOrders, setPendingOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [selectedOrderForOTP, setSelectedOrderForOTP] = useState(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState(null);
  const [notification, setNotification] = useState(null);
  // Initialize otpSentOrders from localStorage immediately (lazy initialization)
  const [otpSentOrders, setOtpSentOrders] = useState(() => {
    try {
      const stored = localStorage.getItem("deliveryOtpSentOrders");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load OTP sent orders:", err);
    }
    return new Set();
  });

  useEffect(() => {
    loadDashboardData();
    loadPendingOrders();
    loadNotifications();
    

    // Auto-refresh every 30 seconds to check for new orders
    const interval = setInterval(() => {
      loadDashboardData();
      loadPendingOrders();
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "deliveryOtpSentOrders",
        JSON.stringify(Array.from(otpSentOrders))
      );
    } catch (err) {
      console.error("Failed to save OTP sent orders:", err);
    }
  }, [otpSentOrders]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await fetchDeliveryDashboardData();
      setDashboardData(data);
      // No need to prune otpSentOrders - keep tracking across page refreshes
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingOrders = async () => {
    try {
      setPendingLoading(true);
      const data = await getPendingDeliveryOrders();
      setPendingOrders(data);
    } catch (err) {
      console.error("Error loading pending orders:", err);
    } finally {
      setPendingLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const data = await getDeliveryNotifications();
      setNotifications(data);
      
      // Count unread notifications
      const unread = data.filter(n => !n.is_read).length;
      
      // Update the counts
      setPreviousUnreadCount(unread);
      setUnreadCount(unread);
    } catch (err) {
      console.error("Error loading notifications:", err);
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
    loadDashboardData();
    loadPendingOrders();
    loadNotifications();
  };

  const handleSendOTP = async (orderId) => {
    setSelectedOrderForOTP(orderId);
    setOtpInput("");
    setGeneratedOTP(null);
    setOtpModalOpen(true);
    setOtpSent(false);

    try {
      setOtpLoading(true);
      await generateDeliveryOTP(orderId);
      setOtpSent(true);
      // Add this order to the otpSentOrders set
      setOtpSentOrders(prev => new Set(prev).add(orderId));
      showNotification('OTP sent to customer successfully! Ask the customer to check their dashboard for the OTP.', 'success');
    } catch (err) {
      console.error("Error sending OTP:", err);
      showNotification('Error: ' + err.message, 'error');
      setOtpModalOpen(false);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOpenOtpEntry = (orderId) => {
    setSelectedOrderForOTP(orderId);
    setOtpInput("");
    setGeneratedOTP(null);
    setOtpSent(true);
    setOtpModalOpen(true);
  };

  const handleVerifyOTP = async () => {
    if (!otpInput || otpInput.length !== 6) {
      showNotification('Please enter a valid 6-digit OTP', 'error');
      return;
    }

    try {
      setOtpLoading(true);
      await verifyDeliveryOTP(selectedOrderForOTP, otpInput);
      showNotification('Delivery completed successfully!', 'success');
      setOtpModalOpen(false);
      setOtpInput("");
      // Remove from otpSentOrders since delivery is now completed
      setOtpSentOrders(prev => {
        const updated = new Set(prev);
        updated.delete(selectedOrderForOTP);
        return updated;
      });
      setSelectedOrderForOTP(null);
      setOtpSent(false);
      loadDashboardData();
    } catch (err) {
      console.error("Error verifying OTP:", err);
      showNotification('Error: ' + err.message, 'error');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleDeliveryAction = async (orderId, action) => {
    try {
      if (action === 'accept') {
        await acceptDeliveryOrder(orderId);
        showNotification('Delivery accepted successfully', 'success');
        loadDashboardData();
        loadPendingOrders();
        loadNotifications();
      } else if (action === 'reject') {
        const reason = prompt("Reason for rejection (optional):");
        await deliveryRejectOrder(orderId, reason || "No reason provided");
        showNotification('Delivery rejected successfully', 'success');
        loadDashboardData();
        loadPendingOrders();
        loadNotifications();
      } else if (action === 'complete') {
        await markDeliveryComplete(orderId);
        showNotification('Delivery completed successfully', 'success');
        setOtpSentOrders((prev) => {
          const updated = new Set(prev);
          updated.delete(orderId);
          return updated;
        });
        loadDashboardData();
      }
    } catch (err) {
      console.error("Delivery action error:", err);
      showNotification('Error: ' + err.message, 'error');
    }
  };

  if (loading) {
    return <div className="delivery-dashboard"><p>Loading...</p></div>;
  }

  if (error) {
    return (
      <div className="delivery-dashboard">
        <div style={{ padding: "24px", textAlign: "center" }}>
          <p style={{ color: "red", fontSize: "1.1rem", marginBottom: "16px" }}>
            Error: {error}
          </p>
          <p style={{ color: "#666", marginBottom: "24px" }}>
            {error.includes("pharmacy") ? "Your account may not be set up as a pharmacy partner. Please contact support or logout and re-login." : "Failed to load dashboard. Please try again."}
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button onClick={loadDashboardData} style={{ padding: "12px 24px", background: "#667eea", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
              Retry
            </button>
            <button onClick={logout} style={{ padding: "12px 24px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { stats, active_deliveries, metrics, driver_performance } =
    dashboardData;

  const deliveryStats = [
    {
      label: "Active Deliveries",
      value: stats.active_deliveries || "0",
      color: "#3b82f6",
    },
    {
      label: "Completed Today",
      value: stats.completed_today || "0",
      color: "#10b981",
    },
    {
      label: "Pending Orders",
      value: stats.pending_orders || "0",
      color: "#f59e0b",
    },
    {
      label: "Avg. Delivery Time",
      value: stats.avg_delivery_time || "0 min",
      color: "#8b5cf6",
    },
  ];

  return (
    <div className="delivery-dashboard" style={{ position: 'relative', minHeight: '100vh', zIndex: 1 }}>
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
      {/* Background Video */}
      <video 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          objectFit: 'cover',
          zIndex: -2
        }}
        autoPlay 
        muted 
        loop
      >
        <source src="/delivery-video.mp4" type="video/mp4" />
        <source src="/background-video.webm" type="video/webm" />
      </video>
      
      {/* Dark overlay for better text readability */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: -1
      }}></div>

      {/* Content wrapper */}
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>

      {/* Header */}
      <div className="delivery-header">
        <div>
          <h1>Delivery Dashboard</h1>
          <p>Track and manage all deliveries in real-time</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleRefresh}
            style={{
              padding: "10px 18px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
            }}
            title="Refresh notifications and orders"
          >
            Refresh
          </button>
          <button
            onClick={logout}
            style={{
              padding: "10px 18px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {deliveryStats.map((stat, idx) => (
          <div
            key={idx}
            className="stat-box"
            style={{ borderLeftColor: stat.color }}
          >
            <div className="stat-header">
              <p className="stat-label">{stat.label}</p>
            </div>
            <h2 className="stat-value">{stat.value}</h2>
          </div>
        ))}
      </div>

      {/* Deliveries & Notifications */}
      <div className="card active-deliveries-card">
        <div className="card-header">
          <h2>{activeTab === 'active' ? 'Active Deliveries' : 'Pending Delivery Orders'}</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setActiveTab('active')}
              style={{
                padding: '8px 16px',
                background: activeTab === 'active' ? '#667eea' : '#e2e8f0',
                color: activeTab === 'active' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Active ({active_deliveries.filter((d) => d.status !== "delivered").length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              style={{
                padding: '8px 16px',
                background: activeTab === 'pending' ? '#667eea' : '#e2e8f0',
                color: activeTab === 'pending' ? 'white' : '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                position: 'relative'
              }}
            >
              Pending ({pendingOrders.length})
              {pendingOrders.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  animation: 'pulse 2s infinite'
                }}>
                  {pendingOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>
        
        <div className="deliveries-container">
          {activeTab === 'active' ? (
            // Active Deliveries
            active_deliveries.length > 0 ? (
              active_deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className={`delivery-item status-${delivery.status
                    .toLowerCase()
                    .replace(" ", "-")}`}
                >
                  <div className="delivery-status-badge">{delivery.status}</div>
                  <div className="delivery-content">
                    <div className="delivery-header-info">
                      <h3>
                        {delivery.order?.user?.full_name || "Customer"}
                      </h3>
                      <span className="delivery-id">
                        Order #{delivery.order?.order_id}
                      </span>
                    </div>

                    <div className="delivery-route">
                      <div className="route-point">
                        <div>
                          <small>From</small>
                          <p>{delivery.pickup_address?.substring(0, 40)}...</p>
                        </div>
                      </div>
                      <div className="route-arrow">→</div>
                      <div className="route-point">
                        <div>
                          <small>To</small>
                          <p>{delivery.delivery_address?.substring(0, 40)}...</p>
                        </div>
                      </div>
                    </div>

                    <div className="delivery-details">
                      <div className="detail-item">
                        <span className="detail-label">Driver</span>
                        <p>{delivery.driver_name || "Unassigned"}</p>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Distance</span>
                        <p>{delivery.distance_km?.toFixed(1)} km</p>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">ETA</span>
                        <p className="eta-time">
                          {delivery.estimated_time} mins
                        </p>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Status</span>
                        <p>{delivery.status}</p>
                      </div>
                    </div>

                    <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                      {delivery.status === 'pending' && delivery.driver_name && (
                        <>
                          <button
                            style={{ padding: "6px 12px", background: "#10b981", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                            onClick={() => handleDeliveryAction(delivery.order.order_id, 'accept')}
                          >
                            Accept
                          </button>
                          <button
                            style={{ padding: "6px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                            onClick={() => handleDeliveryAction(delivery.order.order_id, 'reject')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {(delivery.status === 'assigned' || delivery.status === 'at_pickup' || delivery.status === 'in_transit' || delivery.status === 'out_for_delivery') && (
                        <>
                          {!otpSentOrders.has(delivery.order.order_id) ? (
                            <button
                              style={{ 
                                padding: "6px 12px", 
                                background: "#3b82f6", 
                                color: "white", 
                                border: "none", 
                                borderRadius: "4px", 
                                cursor: "pointer", 
                                fontWeight: "600"
                              }}
                              onClick={() => handleSendOTP(delivery.order.order_id)}
                              title="Send OTP to customer"
                            >
                              Send OTP
                            </button>
                          ) : (
                            <>
                              <button
                                style={{ 
                                  padding: "6px 12px", 
                                  background: "#3b82f6", 
                                  color: "white", 
                                  border: "none", 
                                  borderRadius: "4px", 
                                  cursor: "pointer", 
                                  fontWeight: "600"
                                }}
                                onClick={() => handleSendOTP(delivery.order.order_id)}
                                title="Resend OTP to customer"
                              >
                                Resend OTP
                              </button>
                              <button
                                style={{ 
                                  padding: "6px 12px", 
                                  background: "#10b981", 
                                  color: "white", 
                                  border: "none", 
                                  borderRadius: "4px", 
                                  cursor: "pointer", 
                                  fontWeight: "600"
                                }}
                                onClick={() => handleOpenOtpEntry(delivery.order.order_id)}
                                title="Enter OTP to complete delivery"
                              >
                                Enter OTP
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ padding: "24px" }}>No active deliveries</p>
            )
          ) : (
            // Pending Orders Tab
            pendingLoading ? (
              <p style={{ padding: "24px" }}>Loading pending orders...</p>
            ) : pendingOrders.length > 0 ? (
              pendingOrders.map((order) => (
                <div key={order.id} className="delivery-item status-pending">
                  <div className="delivery-status-badge">Pending</div>
                  <div className="delivery-content">
                    <div className="delivery-header-info">
                      <h3>{order.pharmacy_name}</h3>
                      <span className="delivery-id">Order #{order.order_id}</span>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ margin: '6px 0', fontSize: '0.95rem', color: '#333' }}>
                        <strong>Items:</strong> {order.total_items || order.quantity || 1}
                      </p>
                      <p style={{ margin: '6px 0', fontSize: '0.95rem', color: '#333' }}>
                        <strong>Total:</strong> ₹{order.total_price}
                      </p>

                      {Array.isArray(order.medicines) && order.medicines.length > 0 ? (
                        <div style={{ marginTop: '8px', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                          <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: '600', color: '#334155' }}>
                            Medicines in this delivery:
                          </p>
                          {order.medicines.map((item) => (
                            <p key={item.id} style={{ margin: '4px 0', fontSize: '0.88rem', color: '#475569' }}>
                              • {item.medicine_name} × {item.quantity}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: '6px 0', fontSize: '0.95rem', color: '#333' }}>
                          <strong>Medicine:</strong> {order.medicine_name}
                        </p>
                      )}
                    </div>

                    <div className="delivery-route">
                      <div className="route-point">
                        <div>
                          <small>Pickup</small>
                          <p>{order.pharmacy_name}</p>
                        </div>
                      </div>
                      <div className="route-arrow">→</div>
                      <div className="route-point">
                        <div>
                          <small>Delivery</small>
                          <p>{order.delivery_address?.substring(0, 40)}...</p>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                      <button
                        style={{
                          padding: "10px 20px",
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: '600',
                          flex: 1,
                        }}
                        onClick={() => handleDeliveryAction(order.order_id, 'accept')}
                      >
                        Accept Order
                      </button>
                      <button
                        style={{
                          padding: "10px 20px",
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: '600',
                          flex: 1,
                        }}
                        onClick={() => handleDeliveryAction(order.order_id, 'reject')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ padding: "24px" }}>No pending delivery orders available</p>
            )
          )}
        </div>
      </div>

      {/* Notifications Modal */}
      {notificationsOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setNotificationsOpen(false)}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Notifications</h3>
              <button
                onClick={() => setNotificationsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0 8px'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {notifications.map((notif) => (
                    <div key={notif.id} style={{
                      padding: '16px',
                      background: notif.is_read ? '#f8fafc' : '#eff6ff',
                      border: `2px solid ${notif.is_read ? '#e2e8f0' : '#3b82f6'}`,
                      borderRadius: '12px',
                      position: 'relative'
                    }}>
                      {!notif.is_read && (
                        <span style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          width: '10px',
                          height: '10px',
                          background: '#3b82f6',
                          borderRadius: '50%'
                        }} />
                      )}
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>
                        {notif.title}
                      </h4>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#475569' }}>
                        {notif.message}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                        <small style={{ color: '#64748b' }}>
                          Order #{notif.order_id}
                        </small>
                        <button
                          onClick={() => {
                            setNotificationsOpen(false);
                            setActiveTab('pending');
                          }}
                          style={{
                            padding: '6px 16px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.85rem'
                          }}
                        >
                          View Order
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OTP Modal */}
      {otpModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => !otpLoading && setOtpModalOpen(false)}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '450px',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(59, 130, 246, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                {otpSent ? 'Enter OTP from Customer' : 'Sending OTP...'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#64748b' }}>
                {otpSent 
                  ? 'OTP has been sent to customer. Ask the customer for the OTP from their dashboard.'
                  : 'Sending OTP to customer...'}
              </p>
            </div>

            {otpSent && (
              <>
                <div style={{
                  marginBottom: '24px',
                  padding: '20px',
                  background: '#eff6ff',
                  border: '2px solid #3b82f6',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#1e3a8a', fontWeight: '600', lineHeight: '1.6' }}>
                    The customer has received the OTP in their User Dashboard.<br/>
                    Ask them to tell you the 6-digit code.
                  </p>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>
                    Enter OTP provided by customer:
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    disabled={otpLoading}
                    style={{
                      width: '100%',
                      padding: '16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      textAlign: 'center',
                      letterSpacing: '8px',
                      color: '#1e293b',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleVerifyOTP}
                    disabled={otpLoading || otpInput.length !== 6}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: otpInput.length === 6 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '1rem',
                      fontWeight: '700',
                      cursor: otpInput.length === 6 && !otpLoading ? 'pointer' : 'not-allowed',
                      transition: 'all 0.3s ease',
                      boxShadow: otpInput.length === 6 ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                    }}
                  >
                    {otpLoading ? 'Verifying...' : 'Verify & Complete Delivery'}
                  </button>
                </div>

                <button
                  onClick={() => handleSendOTP(selectedOrderForOTP)}
                  disabled={otpLoading}
                  style={{
                    width: '100%',
                    marginTop: '12px',
                    padding: '12px',
                    background: 'transparent',
                    color: '#3b82f6',
                    border: '2px solid #3b82f6',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: otpLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Generate New OTP
                </button>
              </>
            )}

            {otpLoading && !otpSent && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: '#64748b', margin: 0, fontSize: '1.05rem', fontWeight: '600' }}>
                  Generating OTP...
                </p>
                <p style={{ color: '#94a3b8', margin: '8px 0 0 0', fontSize: '0.9rem' }}>
                  Please wait, OTP is being created
                </p>
              </div>
            )}

            <button
              onClick={() => setOtpModalOpen(false)}
              disabled={otpLoading}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '12px',
                background: 'transparent',
                color: '#64748b',
                border: 'none',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: otpLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

