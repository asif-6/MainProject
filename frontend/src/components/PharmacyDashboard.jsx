import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getPharmacyOrders, pharmacyAcceptOrder, pharmacyRejectOrder } from "../services/dashboardApi";

const API_BASE_URL = "http://localhost:8000/api";

const getAuthToken = () => localStorage.getItem("authToken") || localStorage.getItem("token");

const getHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Token ${token}` }),
  };
};

function PharmacyDashboard() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({ stats: {}, medicines: [], recent_orders: [], weekly_sales: [] });
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [addMedicineOpen, setAddMedicineOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewAllType, setViewAllType] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [medicineStock, setMedicineStock] = useState("");
  const [medicinePrice, setMedicinePrice] = useState("");
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkMedicinesText, setBulkMedicinesText] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [medicineRequests, setMedicineRequests] = useState([]);
  const [medicineRequestsModalOpen, setMedicineRequestsModalOpen] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/pharmacy-dashboard/`, {
        headers: getHeaders(),
      });

      if (res.status === 401) {
        // Not authenticated - clear token and redirect to login
        localStorage.removeItem("authToken");
        navigate("/login");
        return;
      }

      if (res.status === 403) {
        // Forbidden (e.g., user is not set up as a pharmacy) - show server message
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || "Unauthorized access");
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || "Failed to fetch dashboard");
      }

      const data = await res.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("email");
    navigate("/login");
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

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddMedicine = async () => {
    if (!medicineName.trim()) {
      showNotification('Please enter medicine name', 'error');
      return;
    }

    try {
      // 1) Try to create a Medicine record
      const medPayload = {
        name: medicineName.trim(),
        generic_name: "",
        dosage: "",
        unit: "",
      };

      let medData = null;
      const medRes = await fetch(`${API_BASE_URL}/medicines/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(medPayload),
      });

      if (medRes.ok) {
        medData = await medRes.json();
      } else {
        // Read error from failed POST attempt
        let medError = "";
        try {
          const errBody = await medRes.json();
          medError = errBody.detail || errBody.message || JSON.stringify(errBody) || "Unknown error";
        } catch {
          medError = `HTTP ${medRes.status}`;
        }
        
        console.log(`Medicine creation failed: ${medError}`);
        
        // If creation failed (likely duplicate), try to find existing by name
        const listRes = await fetch(`${API_BASE_URL}/medicines/`, { headers: getHeaders() });
        if (!listRes.ok) throw new Error("Failed to create or locate medicine");
        const list = await listRes.json();
        medData = list.find(m => m.name && m.name.toLowerCase() === medicineName.trim().toLowerCase());
        if (!medData) {
          throw new Error(`Failed to create medicine: ${medError}`);
        }
      }

      // 2) Create PharmacyMedicine linking this medicine to the pharmacy
      const pmPayload = {
        medicine_id: medData.id,
        stock: Number(medicineStock) || 0,
        price: Number(medicinePrice) || 0.0,
      };

      const pmRes = await fetch(`${API_BASE_URL}/pharmacy-medicines/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(pmPayload),
      });

      if (!pmRes.ok) {
        const err = await pmRes.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to add medicine to inventory");
      }

      showNotification(`Medicine "${medData.name}" added successfully!`, 'success');
      setMedicineName("");
      setMedicineStock("");
      setMedicinePrice("");
      setAddMedicineOpen(false);
      loadDashboardData();
    } catch (err) {
      console.error("Add medicine error:", err);
      showNotification(err.message || 'Failed to add medicine', 'error');
    }
  };

  const handleBulkAddMedicines = async () => {
    if (!bulkMedicinesText.trim()) {
      showNotification('Please enter medicine details', 'error');
      return;
    }

    try {
      // Parse CSV format: Name,Stock,Price (one per line)
      const lines = bulkMedicinesText.trim().split('\n').filter(line => line.trim());
      const medicines = lines.map(line => {
        const [name, stock, price] = line.split(',').map(s => s.trim());
        if (!name) throw new Error("Medicine name is required");
        return { name, stock: Number(stock) || 0, price: Number(price) || 0 };
      });

      if (medicines.length === 0) {
        showNotification('No valid medicines found', 'error');
        return;
      }

      let successCount = 0;
      let failedCount = 0;

      for (const med of medicines) {
        try {
          // Get or create medicine
          const medPayload = {
            name: med.name,
            generic_name: "",
            dosage: "",
            unit: "",
          };

          let medData = null;
          const medRes = await fetch(`${API_BASE_URL}/medicines/`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(medPayload),
          });

          if (medRes.ok) {
            medData = await medRes.json();
          } else {
            const listRes = await fetch(`${API_BASE_URL}/medicines/`, { headers: getHeaders() });
            const list = await listRes.json();
            medData = list.find(m => m.name && m.name.toLowerCase() === med.name.toLowerCase());
            if (!medData) throw new Error("Medicine not found or created");
          }

          // Add to pharmacy inventory
          const pmPayload = {
            medicine_id: medData.id,
            stock: med.stock,
            price: med.price,
          };

          const pmRes = await fetch(`${API_BASE_URL}/pharmacy-medicines/`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(pmPayload),
          });

          if (pmRes.ok) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
        }
      }

      showNotification(`Added ${successCount} medicines${failedCount > 0 ? ` (${failedCount} failed)` : ''}`, 'success');
      setBulkMedicinesText("");
      setBulkAddOpen(false);
      loadDashboardData();
    } catch (err) {
      console.error("Bulk add error:", err);
      showNotification(err.message || 'Failed to add medicines', 'error');
    }
  };

  const handleViewAll = (type) => {
    setViewAllType(type);
    setViewAllOpen(true);
  };

  // Order management functions
  const loadOrders = async () => {
    try {
      const ordersData = await getPharmacyOrders();
      setOrders(ordersData);
    } catch (err) {
      console.error("Error loading orders:", err);
    }
  };

  const handleOrderAction = async (orderId, action) => {
    try {
      const res = await fetch(`${API_BASE_URL}/pharmacy-accept-order/${orderId}/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ action }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        // Handle stock errors with detailed messages
        if (data.details && Array.isArray(data.details)) {
          const errorMsg = `${data.error || 'Order processing failed'}:\n${data.details.join('\n')}`;
          setNotification({ type: 'error', message: data.error || 'Order processing failed' });
          setTimeout(() => setNotification(null), 4000);
          showNotification(errorMsg, 'error');
          return;
        }
        throw new Error(data.detail || data.message || data.error || "Failed to process order");
      }
      
      const itemsCount = data.items_count || 1;
      const successMessage = action === 'accept' 
        ? `Order confirmed successfully! ${itemsCount} medicine${itemsCount > 1 ? 's' : ''} approved. User will be notified.` 
        : `Order rejected successfully! ${itemsCount} medicine${itemsCount > 1 ? 's' : ''} rejected.`;
      
      // Show notification
      setNotification({ type: action === 'accept' ? 'success' : 'info', message: successMessage });
      setTimeout(() => setNotification(null), 3000);
      
      showNotification(successMessage, 'success');
      loadOrders();
      loadDashboardData();
    } catch (err) {
      console.error("Order action error:", err);
      const errorMsg = err.message || "Failed to process order";
      setNotification({ type: 'error', message: errorMsg });
      setTimeout(() => setNotification(null), 3000);
      showNotification(errorMsg, 'error');
    }
  };

  // Medicine request management functions
  const loadMedicineRequests = async () => {
    try {
      setRequestLoading(true);
      const res = await fetch(`${API_BASE_URL}/restock-requests/`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to load medicine requests");
      }
      const data = await res.json();
      setMedicineRequests(data);
    } catch (err) {
      console.error("Error loading medicine requests:", err);
      showNotification(err.message || 'Failed to load medicine requests', 'error');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/restock-requests/${requestId}/approve/`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to approve request");
      }
      showNotification('Request approved successfully', 'success');
      loadMedicineRequests();
      loadDashboardData();
    } catch (err) {
      console.error("Approve request error:", err);
      showNotification(err.message || 'Failed to approve request', 'error');
    }
  };

  const handleRejectRequest = async (requestId) => {
    const reason = prompt("Reason for rejection (optional):");
    try {
      const res = await fetch(`${API_BASE_URL}/restock-requests/${requestId}/reject/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ reason: reason || "No reason provided" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to reject request");
      }
      showNotification('Request rejected successfully', 'success');
      loadMedicineRequests();
      loadDashboardData();
    } catch (err) {
      console.error("Reject request error:", err);
      showNotification(err.message || 'Failed to reject request', 'error');
    }
  };

  // Load orders and medicine requests on component mount
  useEffect(() => {
    loadOrders();
    loadMedicineRequests();
  }, []);

  if (loading) return <div style={s.container}><div style={s.loading}><div style={s.spinner}></div><p>Loading...</p></div></div>;
  if (error) return <div style={s.container}><div style={s.error}><p>Error: {error}</p><button style={s.retry} onClick={loadDashboardData}>Retry</button></div></div>;

  const { stats, medicines, recent_orders, weekly_sales } = dashboardData;
  const maxSales = Math.max(...weekly_sales.map(i => i.sales), 1);

  return (
    <div style={s.pageWrapper}>
      {/* Background Video */}
      <video
        style={s.backgroundVideo}
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/pharmacy-video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Background Overlay (Gradient) */}
      <div style={s.backgroundOverlay}></div>

      {/* Main Content */}
      <div style={s.mainContent}>
        {/* Notification Toast */}
        {notification && (
        <div style={{
          ...s.notification,
          backgroundColor: notification.type === 'success' ? '#dcfce7' : notification.type === 'error' ? '#fee2e2' : '#dbeafe',
          borderColor: notification.type === 'success' ? '#166534' : notification.type === 'error' ? '#991b1b' : '#1e40af',
          color: notification.type === 'success' ? '#166534' : notification.type === 'error' ? '#991b1b' : '#1e40af'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.2rem' }}>
              {notification.type === 'success' ? '→' : notification.type === 'error' ? '!' : '•'}
            </span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}
      
      <div style={s.header}>
        <div><h1 style={s.h1}>Pharmacy Dashboard</h1><p style={s.subtitle}>Manage inventory, orders, and sales analytics</p></div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button style={s.addBtn} onClick={() => setAddMedicineOpen(true)}>+ Add Medicine</button>
          <button style={{ ...s.addBtn, background: "#7c3aed" }} onClick={() => setBulkAddOpen(true)}>+ Bulk Add</button>
          <button style={{ ...s.addBtn, background: "#8b5cf6" }} onClick={() => setMedicineRequestsModalOpen(true)}>Medicine Requests</button>
          <button style={{ ...s.addBtn, background: "#f59e0b" }} onClick={() => setOrdersModalOpen(true)}>Orders</button>
          <button style={{ ...s.addBtn, background: "#667eea" }} onClick={viewProfile} disabled={profileLoading}>
            {profileLoading ? "Loading..." : "My Profile"}
          </button>
          <button style={{ ...s.addBtn, background: "#ef4444" }} onClick={logout}>Logout</button>
          <button style={{ ...s.addBtn, background: "#10b981" }} onClick={loadDashboardData}>Refresh</button>
        </div>
      </div>

      <div style={s.grid4}>
        {[
          { label: "Total Medicines", value: stats.total_medicines || "0", bg: "#dbeafe", color: "#3b82f6" },
          { label: "Low Stock Items", value: stats.low_stock_items || "0", bg: "#fee2e2", color: "#ef4444" },
          { label: "Today's Orders", value: stats.today_orders || "0", bg: "#d1fae5", color: "#10b981" },
          { label: "Revenue", value: `₹${parseFloat(stats.revenue || 0).toFixed(2)}`, bg: "#fef3c7", color: "#f59e0b" },
        ].map((stat, i) => (
          <div key={i} style={s.statBox}>
            <div style={{...s.iconBox, backgroundColor: stat.bg, color: stat.color}}>◆</div>
            <div><p style={s.label}>{stat.label}</p><h2 style={s.value}>{stat.value}</h2></div>
          </div>
        ))}
      </div>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.h2}>Weekly Sales</h2>
            <div style={s.tabs}>
              <button style={selectedPeriod === "week" ? s.tabActive : s.tab} onClick={() => setSelectedPeriod("week")}>Week</button>
              <button style={selectedPeriod === "month" ? s.tabActive : s.tab} onClick={() => setSelectedPeriod("month")}>Month</button>
            </div>
          </div>
          <div style={s.chart}>
            {weekly_sales.map((item, i) => (
              <div key={i} style={s.barItem}>
                <div style={s.barWrap}><div style={{...s.bar, height: `${(item.sales / maxSales) * 200}px`}}></div></div>
                <span style={s.barLabel}>{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}><h2 style={s.h2}>Medicine Inventory</h2><a onClick={() => handleViewAll("medicines")} style={{...s.link, cursor: "pointer"}}>View All →</a></div>
          <div style={s.list}>
            {medicines.map((m, i) => (
              <div key={i} style={s.item}>
                <div><h4 style={s.h4}>{m.medicine?.name || "Unknown"} {m.medicine?.dosage || ""}</h4><p style={s.stock}>Stock: {m.stock} units</p></div>
                <div style={s.right}>
                  <span style={s.price}>₹{(Number(m.price) || 0).toFixed(2)}</span>
                  <span style={m.status === "in_stock" ? s.statusGreen : m.status === "low_stock" ? s.statusYellow : s.statusRed}>
                    {m.status?.replace("_", " ").charAt(0).toUpperCase() + m.status?.slice(1).replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardHeader}><h2 style={s.h2}>Recent Orders</h2><a onClick={() => handleViewAll("orders")} style={{...s.link, cursor: "pointer"}}>View All →</a></div>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Order ID</th><th style={s.th}>Items</th><th style={s.th}>Total</th><th style={s.th}>Status</th></tr></thead>
            <tbody>
              {recent_orders.map(o => (
                <tr key={o.id}><td style={s.td}><b>{o.order_id}</b></td><td style={s.td}>{o.items?.length || 0} items</td><td style={s.td}><b>₹{(Number(o.total_amount) || 0).toFixed(2)}</b></td>
                  <td style={s.td}><span style={o.status === "completed" ? s.statusGreen : o.status === "pending" ? s.statusYellow : s.statusBlue}>
                    {o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>


      </div>

      {/* Profile Modal */}
      {profileOpen && (
        <div style={s.modalOverlay} onClick={() => setProfileOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
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
              <button style={s.addBtn} onClick={() => setProfileOpen(false)}>Close</button>
              <button style={{ ...s.addBtn, background: "#ef4444" }} onClick={logout}>Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Medicine Modal */}
      {addMedicineOpen && (
        <div style={s.modalOverlay} onClick={() => setAddMedicineOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add New Medicine</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Medicine Name</label>
              <input type="text" placeholder="e.g., Paracetamol" value={medicineName} onChange={(e) => setMedicineName(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Stock Quantity</label>
              <input type="number" placeholder="e.g., 100" value={medicineStock} onChange={(e) => setMedicineStock(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Price (₹)</label>
              <input type="number" placeholder="e.g., 5.99" value={medicinePrice} onChange={(e) => setMedicinePrice(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={s.addBtn} onClick={() => setAddMedicineOpen(false)}>Cancel</button>
              <button style={{ ...s.addBtn, background: "#10b981" }} onClick={handleAddMedicine}>Add Medicine</button>
            </div>
          </div>
        </div>
      )}

      {/* View All Modal */}
      {viewAllOpen && (
        <div style={s.modalOverlay} onClick={() => setViewAllOpen(false)}>
          <div style={{...s.modal, maxWidth: "600px", maxHeight: "80vh", overflowY: "auto"}} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{viewAllType === "medicines" ? "All Medicines" : "All Orders"}</h3>
            {viewAllType === "medicines" ? (
              <div style={s.list}>
                {medicines.map((m, i) => (
                  <div key={i} style={s.item}>
                    <div><h4 style={s.h4}>{m.medicine?.name} {m.medicine?.dosage}</h4><p style={s.stock}>Stock: {m.stock} units</p></div>
                    <div style={s.right}><span style={s.price}>₹{m.price}</span><span style={m.status === "in_stock" ? s.statusGreen : m.status === "low_stock" ? s.statusYellow : s.statusRed}>{m.status}</span></div>
                  </div>
                ))}
              </div>
            ) : (
              <table style={s.table}>
                <thead><tr><th style={s.th}>Order ID</th><th style={s.th}>Items</th><th style={s.th}>Total</th><th style={s.th}>Status</th></tr></thead>
                <tbody>
                  {recent_orders.map(o => (
                    <tr key={o.id}><td style={s.td}>{o.order_id}</td><td style={s.td}>{o.items?.length || 0}</td><td style={s.td}>₹{o.total_amount}</td><td style={s.td}>{o.status}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <button style={{...s.addBtn, marginTop: 16, width: "100%"}} onClick={() => setViewAllOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Orders Modal */}
      {ordersModalOpen && (
        <div style={s.modalOverlay} onClick={() => setOrdersModalOpen(false)}>
          <div style={{...s.modal, maxWidth: "900px", maxHeight: "80vh", overflowY: "auto"}} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Order Management</h3>
            {orders.length === 0 ? (
              <p>No orders to manage.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {orders.map((order) => (
                  <div key={order.order_id} style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h4 style={{ margin: 0 }}>Order #{order.order_id}</h4>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        backgroundColor: order.order_status === 'pharmacy_accepted' ? '#dcfce7' : order.order_status === 'pending_pharmacy_confirmation' ? '#fef3c7' : '#fee2e2',
                        color: order.order_status === 'pharmacy_accepted' ? '#166534' : order.order_status === 'pending_pharmacy_confirmation' ? '#92400e' : '#991b1b'
                      }}>
                        {order.order_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    
                    {/* Display all medicines in this order */}
                    <div style={{ marginTop: "12px", marginBottom: "12px" }}>
                      <strong>Medicines:</strong>
                      <div style={{ marginTop: "8px", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                        {order.medicines && order.medicines.length > 0 ? (
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ backgroundColor: "#f8fafc" }}>
                                <th style={{ ...s.th, padding: "8px 12px", fontSize: "0.8rem" }}>Medicine</th>
                                <th style={{ ...s.th, padding: "8px 12px", fontSize: "0.8rem" }}>Quantity</th>
                                <th style={{ ...s.th, padding: "8px 12px", fontSize: "0.8rem" }}>Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.medicines.map((med, idx) => (
                                <tr key={idx} style={{ borderTop: idx > 0 ? "1px solid #e2e8f0" : "none" }}>
                                  <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
                                    {med.medicine_name} {med.medicine_dosage}
                                  </td>
                                  <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{med.quantity}</td>
                                  <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>₹{med.price}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p style={{ padding: "8px 12px", margin: 0, fontSize: "0.85rem" }}>No medicines listed</p>
                        )}
                      </div>
                    </div>
                    
                    <p style={{ margin: "4px 0" }}><strong>Total:</strong> ₹{order.total_price?.toFixed(2)}</p>
                    <p style={{ margin: "4px 0" }}><strong>User:</strong> {order.user_name || order.user}</p>
                    {order.delivery_required && (
                      <p style={{ margin: "4px 0" }}><strong>Delivery Address:</strong> {order.delivery_address}</p>
                    )}
                    <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#64748b" }}>
                      <strong>Created:</strong> {new Date(order.created_at).toLocaleString()}
                    </p>
                    
                    {order.order_status === 'pending_pharmacy_confirmation' && (
                      <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                        <button
                          style={{ ...s.addBtn, background: "#10b981", padding: "8px 16px" }}
                          onClick={() => handleOrderAction(order.order_id, 'accept')}
                        >
                          Accept All ({order.medicines?.length || 0} items)
                        </button>
                        <button
                          style={{ ...s.addBtn, background: "#ef4444", padding: "8px 16px" }}
                          onClick={() => handleOrderAction(order.order_id, 'reject')}
                        >
                          Reject All
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button style={s.addBtn} onClick={() => setOrdersModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Medicine Requests Modal */}
      {medicineRequestsModalOpen && (
        <div style={s.modalOverlay} onClick={() => setMedicineRequestsModalOpen(false)}>
          <div style={{...s.modal, maxWidth: "800px", maxHeight: "80vh", overflowY: "auto"}} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Medicine Restock Requests</h3>
            {requestLoading ? (
              <p>Loading requests...</p>
            ) : medicineRequests.length === 0 ? (
              <p>No medicine requests pending.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {medicineRequests.map((request) => (
                  <div key={request.id} style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h4 style={{ margin: 0 }}>Request #{request.id}</h4>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        backgroundColor: request.status === 'approved' ? '#dcfce7' : request.status === 'pending' ? '#fef3c7' : '#fee2e2',
                        color: request.status === 'approved' ? '#166534' : request.status === 'pending' ? '#92400e' : '#991b1b'
                      }}>
                        {request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'Pending'}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0" }}><strong>Medicine:</strong> {request.medicine_name || request.medicine}</p>
                    <p style={{ margin: "4px 0" }}><strong>Quantity Requested:</strong> {request.quantity} units</p>
                    <p style={{ margin: "4px 0" }}><strong>Pharmacy:</strong> {request.pharmacy_name || "Your Pharmacy"}</p>
                    {request.created_at && (
                      <p style={{ margin: "4px 0" }}><strong>Date:</strong> {new Date(request.created_at).toLocaleDateString()}</p>
                    )}
                    {request.status === 'pending' && (
                      <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                        <button
                          style={{ ...s.addBtn, background: "#10b981", padding: "8px 16px", fontSize: "0.85rem" }}
                          onClick={() => handleApproveRequest(request.id)}
                        >
                          Approve
                        </button>
                        <button
                          style={{ ...s.addBtn, background: "#ef4444", padding: "8px 16px", fontSize: "0.85rem" }}
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button style={s.addBtn} onClick={() => setMedicineRequestsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Medicines Modal */}
      {bulkAddOpen && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h1>Add Multiple Medicines</h1>
              <button onClick={() => setBulkAddOpen(false)} style={s.closeBtn}>×</button>
            </div>
            <div style={s.modalContent}>
              <p style={{ marginBottom: "10px", color: "#666" }}>
                Enter medicine details in CSV format (one per line):<br/>
                <strong>Format: Name,Stock,Price</strong>
              </p>
              <p style={{ marginBottom: "15px", color: "#999", fontSize: "0.9rem" }}>
                Example:<br/>
                Paracetamol,100,5.50<br/>
                Ibuprofen,50,8.25<br/>
                Aspirin,75,3.75
              </p>
              <textarea
                value={bulkMedicinesText}
                onChange={(e) => setBulkMedicinesText(e.target.value)}
                placeholder="Paracetamol,100,5.50&#10;Ibuprofen,50,8.25&#10;Aspirin,75,3.75"
                style={{
                  width: "100%",
                  height: "300px",
                  padding: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "monospace",
                  boxSizing: "border-box"
                }}
              />
              <div style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  style={{...s.addBtn, background: "#6b7280"}}
                  onClick={() => setBulkAddOpen(false)}
                >
                  Cancel
                </button>
                <button
                  style={{...s.addBtn, background: "#7c3aed"}}
                  onClick={handleBulkAddMedicines}
                >
                  Add All Medicines
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

export default PharmacyDashboard;

const s = {
  pageWrapper: { 
    position: "relative", 
    minHeight: "100vh", 
    overflow: "hidden" 
  },
  backgroundVideo: { 
    position: "fixed", 
    top: 0, 
    left: 0, 
    width: "100%", 
    height: "100%", 
    objectFit: "cover", 
    zIndex: -2 
  },
  backgroundOverlay: { 
    position: "fixed", 
    top: 0, 
    left: 0, 
    width: "100%", 
    height: "100%", 
    background: "radial-gradient(1200px 600px at 15% 10%, rgba(215, 241, 236, 0.65) 0%, transparent 55%), radial-gradient(1000px 700px at 85% 15%, rgba(248, 234, 216, 0.6) 0%, transparent 60%), linear-gradient(160deg, rgba(247, 251, 250, 0.65) 0%, rgba(233, 242, 241, 0.65) 45%, rgba(247, 242, 234, 0.65) 100%)", 
    zIndex: -1 
  },
  mainContent: { 
    position: "relative", 
    minHeight: "100vh", 
    padding: "24px", 
    fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif", 
    zIndex: 1, 
    background: "transparent" 
  },
  notification: { 
    position: "fixed", 
    top: "20px", 
    right: "20px", 
    padding: "16px 24px", 
    borderRadius: "12px", 
    border: "2px solid", 
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)", 
    zIndex: 100,
    animation: "slideIn 0.3s ease-out"
  },
  container: { minHeight: "100vh", background: "radial-gradient(1200px 600px at 15% 10%, #d7f1ec 0%, transparent 55%), radial-gradient(1000px 700px at 85% 15%, #f8ead8 0%, transparent 60%), linear-gradient(160deg, #f7fbfa 0%, #e9f2f1 45%, #f7f2ea 100%)", padding: "24px", fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif" },
  loading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px" },
  spinner: { width: "50px", height: "50px", border: "4px solid #e2e8f0", borderTop: "4px solid #0f766e", borderRadius: "50%", animation: "spin 1s linear infinite" },
  error: { textAlign: "center", padding: "40px", color: "#ef4444" },
  retry: { padding: "10px 24px", background: "linear-gradient(135deg, #0f766e 0%, #1aa091 100%)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", marginTop: "16px" },
  header: { background: "white", borderRadius: "16px", padding: "32px", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" },
  h1: { fontSize: "2rem", fontWeight: "700", color: "#0f172a", margin: "0 0 8px 0" },
  subtitle: { fontSize: "1rem", color: "#64748b", margin: 0 },
  addBtn: { padding: "12px 24px", background: "linear-gradient(135deg, #0f766e 0%, #1aa091 100%)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.95rem", fontWeight: "600", cursor: "pointer" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "24px" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "24px", marginBottom: "24px" },
  statBox: { background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: "16px" },
  iconBox: { width: "56px", height: "56px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" },
  label: { fontSize: "0.9rem", color: "#64748b", margin: "0 0 6px 0", fontWeight: "500" },
  value: { fontSize: "1.8rem", fontWeight: "700", color: "#0f172a", margin: 0 },
  card: { background: "white", borderRadius: "16px", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" },
  h2: { fontSize: "1.3rem", fontWeight: "700", color: "#0f172a", margin: 0 },
  link: { fontSize: "0.9rem", color: "#0f766e", textDecoration: "none", fontWeight: "600" },
  tabs: { display: "flex", gap: "8px", background: "#f1f5f9", padding: "4px", borderRadius: "8px" },
  tab: { padding: "8px 16px", background: "transparent", border: "none", borderRadius: "6px", fontSize: "0.9rem", fontWeight: "600", color: "#64748b", cursor: "pointer" },
  tabActive: { padding: "8px 16px", background: "white", border: "none", borderRadius: "6px", fontSize: "0.9rem", fontWeight: "600", color: "#0f766e", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  chart: { display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: "12px", height: "240px", padding: "20px 10px 0" },
  barItem: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1 },
  barWrap: { width: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end", height: "200px" },
  bar: { width: "100%", maxWidth: "60px", background: "linear-gradient(180deg, #0f766e 0%, #1aa091 100%)", borderRadius: "8px 8px 0 0" },
  barLabel: { marginTop: "10px", fontSize: "0.85rem", color: "#64748b", fontWeight: "600" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  item: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px" },
  h4: { fontSize: "1.05rem", fontWeight: "600", color: "#1e293b", margin: "0 0 6px 0" },
  stock: { fontSize: "0.9rem", color: "#64748b", margin: 0 },
  right: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" },
  price: { fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" },
  statusGreen: { padding: "6px 12px", background: "#dcfce7", color: "#166534", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "600" },
  statusYellow: { padding: "6px 12px", background: "#fef3c7", color: "#92400e", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "600" },
  statusRed: { padding: "6px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "600" },
  statusBlue: { padding: "6px 12px", background: "#dbeafe", color: "#1e40af", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "600" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px 16px", fontSize: "0.85rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" },
  td: { padding: "16px", fontSize: "0.95rem", color: "#475569", borderBottom: "1px solid #f1f5f9" },
  actions: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "20px" },
  actionBtn: { display: "flex", alignItems: "center", gap: "16px", padding: "20px", background: "#f8fafc", border: "2px solid #e2e8f0", borderRadius: "12px", cursor: "pointer", textAlign: "left" },
  actionIcon: { width: "48px", height: "48px", background: "linear-gradient(135deg, #0f766e 0%, #1aa091 100%)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "24px" },
  actionTitle: { fontSize: "1rem", fontWeight: "600", color: "#1e293b", margin: "0 0 4px 0" },
  actionSub: { fontSize: "0.85rem", color: "#64748b" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modal: { background: "white", color: "#0f172a", padding: "20px", borderRadius: "12px", width: "90%", maxWidth: "420px", boxShadow: "0 12px 40px rgba(2,6,23,0.4)" },
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin { 
    0% { transform: rotate(0deg); } 
    100% { transform: rotate(360deg); } 
  }
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
`;
document.head.appendChild(styleSheet);