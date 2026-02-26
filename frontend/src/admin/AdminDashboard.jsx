import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/admin.css";

const API_BASE_URL = "http://localhost:8000/api";

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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [showOrders, setShowOrders] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [showUsers, setShowUsers] = useState(false);
  const [userFilter, setUserFilter] = useState("all");
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    
    const loadData = async () => {
      try {
        // Load orders
        const ordersResponse = await fetch(`${API_BASE_URL}/orders/`, {
          headers: getHeaders()
        });
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          setOrders(ordersData.results || ordersData);
        }

        // Load delivery partners
        const partnersResponse = await fetch(`${API_BASE_URL}/users/?role=delivery`, {
          headers: getHeaders()
        });
        if (partnersResponse.ok) {
          const partners = await partnersResponse.json();
          setDeliveryPartners(partners.results || partners);
        }

        // Load all users for user management
        const usersResponse = await fetch(`${API_BASE_URL}/users/`, {
          headers: getHeaders()
        });
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          setAllUsers(users.results || users);
        }
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };

    loadData();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const assignDeliveryPartner = async (orderId, partnerId) => {
    try {
      await assignDeliveryPartner(orderId, partnerId);
      showNotification('Delivery partner assigned successfully', 'success');
      // Reload orders
      const ordersResponse = await fetch(`${API_BASE_URL}/orders/`, {
        headers: getHeaders()
      });
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        setOrders(ordersData.results || ordersData);
      }
    } catch (err) {
      console.error("Assignment error:", err);
      showNotification('Error: ' + err.message, 'error');
    }
  };

  const deleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (response.ok) {
        showNotification('User deleted successfully', 'success');
        // Reload users
        const usersResponse = await fetch(`${API_BASE_URL}/users/`, {
          headers: getHeaders()
        });
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          setAllUsers(users.results || users);
        }
      } else {
        const error = await response.json();
        showNotification('Error deleting user: ' + (error.detail || 'Unknown error'), 'error');
      }
    } catch (err) {
      console.error("Delete error:", err);
      showNotification('Error: ' + err.message, 'error');
    }
  };
  return (
    <div>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 className="page-title">Dashboard</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={{ padding: "10px 20px", background: "#10b981", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
            onClick={() => window.location.reload()}
            title="Refresh page"
          >
            Refresh
          </button>
          <button
            style={{ padding: "10px 20px", background: "#0f766e", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
            onClick={() => setShowUsers(!showUsers)}
          >
            {showUsers ? "Hide Users" : "Manage Users"}
          </button>
          <button
            style={{ padding: "10px 20px", background: "#1aa091", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
            onClick={() => setShowOrders(!showOrders)}
          >
            {showOrders ? "Hide Orders" : "Manage Orders"}
          </button>
        </div>
      </div>

      {showUsers && (
        <div style={{ marginBottom: "30px", padding: "20px", background: "white", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3>User Management</h3>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
            >
              <option value="all">All Users</option>
              <option value="user">Customers</option>
              <option value="pharmacy">Pharmacies</option>
              <option value="delivery">Delivery Partners</option>
              <option value="admin">Admins</option>
            </select>
          </div>

          {allUsers.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {allUsers
                .filter(user => userFilter === "all" || user.role === userFilter)
                .map((user) => (
                <div key={user.id} style={{ padding: "15px", border: "1px solid #e2e8f0", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ margin: "0 0 5px 0" }}>{user.full_name}</h4>
                    <p style={{ margin: "0 0 5px 0", color: "#666" }}>{user.email}</p>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      backgroundColor: 
                        user.role === 'admin' ? '#fef3c7' : 
                        user.role === 'pharmacy' ? '#dbeafe' : 
                        user.role === 'delivery' ? '#dcfce7' : '#f3f4f6',
                      color: 
                        user.role === 'admin' ? '#92400e' : 
                        user.role === 'pharmacy' ? '#1e40af' : 
                        user.role === 'delivery' ? '#166534' : '#374151'
                    }}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                    <span style={{
                      marginLeft: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      backgroundColor: user.is_active ? '#dcfce7' : '#fee2e2',
                      color: user.is_active ? '#166534' : '#991b1b'
                    }}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      onClick={() => deleteUser(user.id, user.full_name)}
                      disabled={user.role === 'admin'} // Prevent deleting other admins
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showOrders && (
        <div style={{ marginBottom: "30px", padding: "20px", background: "white", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <h3>Order Management</h3>
          {orders.length === 0 ? (
            <p>No orders to manage.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {orders.map((order) => (
                <div key={order.id} style={{ padding: "15px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h4 style={{ margin: 0 }}>Order #{order.order_id}</h4>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      backgroundColor: order.order_status === 'delivered' ? '#dcfce7' : order.order_status === 'pending_pharmacy_confirmation' ? '#fef3c7' : '#dbeafe',
                      color: order.order_status === 'delivered' ? '#166534' : order.order_status === 'pending_pharmacy_confirmation' ? '#92400e' : '#1e40af'
                    }}>
                      {order.order_status.replace('_', ' ')}
                    </span>
                  </div>
                  <p style={{ margin: "5px 0" }}><strong>Medicine:</strong> {order.medicine_name}</p>
                  <p style={{ margin: "5px 0" }}><strong>User:</strong> {order.user}</p>
                  <p style={{ margin: "5px 0" }}><strong>Pharmacy:</strong> {order.pharmacy_name}</p>
                  {order.delivery_required && !order.delivery_partner && order.order_status === 'pharmacy_accepted' && (
                    <div style={{ marginTop: "10px" }}>
                      <label style={{ marginRight: "10px" }}>Assign Delivery Partner:</label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            assignDeliveryPartner(order.order_id, e.target.value);
                          }
                        }}
                        style={{ padding: "5px", border: "1px solid #ccc", borderRadius: "4px" }}
                      >
                        <option value="">Select Partner</option>
                        {deliveryPartners.map((partner) => (
                          <option key={partner.id} value={partner.id}>{partner.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {order.delivery_partner && (
                    <p style={{ margin: "5px 0" }}><strong>Delivery Partner:</strong> {order.delivery_partner_name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="cards-grid">
        <div className="stat-card">
          <p>Total Users</p>
          <h2>{allUsers.length}</h2>
          <span>Active community users</span>
        </div>

        <div className="stat-card">
          <p>Pharmacies</p>
          <h2>{allUsers.filter(u => u.role === 'pharmacy').length}</h2>
          <span>Registered pharmacies</span>
        </div>

        <div className="stat-card">
          <p>Medicines</p>
          <h2>0</h2>
          <span>Available items</span>
        </div>

        <div className="stat-card">
          <p>Orders</p>
          <h2>{orders.length}</h2>
          <span>Recent requests</span>
        </div>
      </div>
    </div>
  );
}
