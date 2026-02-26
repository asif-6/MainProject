import { useState, useEffect } from "react";
import { updateDeliveryStatus, assignDeliveryPartner } from "../services/dashboardApi";

export default function ManageDelivery() {
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadDeliveries();
    loadDeliveryPartners();
  }, []);

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8000/api/deliveries/", {
        headers: {
          Authorization: `Token ${localStorage.getItem("authToken") || localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to load deliveries");
      const data = await response.json();
      setDeliveries(data.results || data);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryPartners = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/users/?role=delivery", {
        headers: {
          Authorization: `Token ${localStorage.getItem("authToken") || localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to load delivery partners");
      const data = await response.json();
      setDeliveryPartners(data.results || data);
    } catch (err) {
      console.error("Failed to load delivery partners:", err);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAssignPartner = async () => {
    if (!selectedDelivery || !selectedPartner) {
      showNotification('Please select both delivery and partner', 'error');
      return;
    }

    try {
      await assignDeliveryPartner(selectedDelivery.id, {
        driver_id: selectedPartner,
      });
      showNotification('Delivery partner assigned successfully!', 'success');
      setShowAssignModal(false);
      setSelectedDelivery(null);
      setSelectedPartner(null);
      loadDeliveries();
    } catch (err) {
      showNotification('Error assigning partner: ' + err.message, 'error');
    }
  };

  const handleStatusChange = async (deliveryId, newStatus) => {
    try {
      await updateDeliveryStatus(deliveryId, newStatus);
      showNotification('Status updated successfully!', 'success');
      loadDeliveries();
    } catch (err) {
      showNotification('Error updating status: ' + err.message, 'error');
    }
  };

  const getFilteredDeliveries = () => {
    let filtered = deliveries;
    
    if (filterStatus !== "all") {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    if (sortBy === "recent") {
      filtered = [...filtered].sort((a, b) => 
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
    } else if (sortBy === "urgent") {
      filtered = [...filtered].sort((a, b) => {
        const statusOrder = { pending: 0, assigned: 1, in_transit: 2, delivered: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
    }

    return filtered;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "#f59e0b",
      assigned: "#3b82f6",
      at_pickup: "#8b5cf6",
      in_transit: "#06b6d4",
      out_for_delivery: "#ec4899",
      delivered: "#10b981",
      cancelled: "#ef4444",
    };
    return colors[status] || "#6b7280";
  };

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter(d => d.status === "pending").length,
    inProgress: deliveries.filter(d => ["assigned", "in_transit", "out_for_delivery"].includes(d.status)).length,
    completed: deliveries.filter(d => d.status === "delivered").length,
  };

  if (loading) {
    return (
      <div className="page-container">
        <p style={{ padding: "20px", textAlign: "center", color: "#666" }}>
          Loading deliveries...
        </p>
      </div>
    );
  }

  return (
    <div className="page-container">
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
      <div style={{ marginBottom: "24px" }}>
        <h2 className="page-title">Delivery Management</h2>
        <p className="muted" style={{ marginTop: "8px" }}>
          Track and manage all deliveries, assign delivery partners, and monitor delivery status
        </p>
      </div>

      {error && (
        <div
          className="panel"
          style={{
            background: "#fee2e2",
            borderLeft: "4px solid #ef4444",
            marginBottom: "20px",
            padding: "16px",
          }}
        >
          <p style={{ color: "#991b1b", margin: 0 }}>Error: {error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div className="panel" style={{ borderLeft: "4px solid #3b82f6" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>Total Deliveries</p>
          <h3 style={{ margin: "8px 0 0 0", fontSize: "2rem", color: "#1e293b" }}>{stats.total}</h3>
        </div>
        <div className="panel" style={{ borderLeft: "4px solid #f59e0b" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>Pending</p>
          <h3 style={{ margin: "8px 0 0 0", fontSize: "2rem", color: "#92400e" }}>{stats.pending}</h3>
        </div>
        <div className="panel" style={{ borderLeft: "4px solid #06b6d4" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>In Progress</p>
          <h3 style={{ margin: "8px 0 0 0", fontSize: "2rem", color: "#164e63" }}>{stats.inProgress}</h3>
        </div>
        <div className="panel" style={{ borderLeft: "4px solid #10b981" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>Completed</p>
          <h3 style={{ margin: "8px 0 0 0", fontSize: "2rem", color: "#065f46" }}>{stats.completed}</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="panel" style={{ marginBottom: "24px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "600", color: "#334155" }}>Filter:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "600", color: "#334155" }}>Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            <option value="recent">Most Recent</option>
            <option value="urgent">Urgent First</option>
          </select>
        </div>

        <button
          onClick={loadDeliveries}
          style={{
            marginLeft: "auto",
            padding: "8px 16px",
            background: "#667eea",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Deliveries Table */}
      <div className="panel" style={{ overflowX: "auto" }}>
        {getFilteredDeliveries().length === 0 ? (
          <p style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
            No deliveries found
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#334155" }}>Order ID</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#334155" }}>Customer</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#334155" }}>Status</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#334155" }}>Driver</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#334155" }}>Distance</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600", color: "#334155" }}>ETA</th>
                <th style={{ padding: "12px", textAlign: "center", fontWeight: "600", color: "#334155" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredDeliveries().map((delivery) => (
                <tr
                  key={delivery.id}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    hover: { background: "#f8fafc" },
                  }}
                >
                  <td style={{ padding: "12px", color: "#1e293b", fontWeight: "600" }}>
                    {delivery.order?.order_id || "N/A"}
                  </td>
                  <td style={{ padding: "12px", color: "#475569" }}>
                    {delivery.order?.user?.full_name || "Unknown"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "6px 12px",
                        background: getStatusColor(delivery.status) + "20",
                        color: getStatusColor(delivery.status),
                        borderRadius: "6px",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                        textTransform: "capitalize",
                      }}
                    >
                      {delivery.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px", color: "#475569" }}>
                    {delivery.driver_name || (
                      <span style={{ color: "#f59e0b", fontWeight: "600" }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ padding: "12px", color: "#475569" }}>
                    {delivery.distance_km ? `${delivery.distance_km.toFixed(1)} km` : "N/A"}
                  </td>
                  <td style={{ padding: "12px", color: "#475569" }}>
                    {delivery.estimated_time ? `${delivery.estimated_time} mins` : "N/A"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                      {!delivery.driver_name && (
                        <button
                          onClick={() => {
                            setSelectedDelivery(delivery);
                            setShowAssignModal(true);
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontWeight: "600",
                          }}
                          title="Assign a delivery partner"
                        >
                          Assign
                        </button>
                      )}
                      <select
                        value={delivery.status}
                        onChange={(e) => handleStatusChange(delivery.id, e.target.value)}
                        style={{
                          padding: "6px 8px",
                          border: `2px solid ${getStatusColor(delivery.status)}`,
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          color: getStatusColor(delivery.status),
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="assigned">Assigned</option>
                        <option value="at_pickup">At Pickup</option>
                        <option value="in_transit">In Transit</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowAssignModal(false)}
        >
          <div
            className="panel"
            style={{
              width: "90%",
              maxWidth: "500px",
              padding: "32px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: "24px", fontSize: "1.5rem", color: "#1e293b" }}>
              Assign Delivery Partner
            </h3>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", color: "#334155" }}>
                Order: {selectedDelivery?.order?.order_id}
              </label>
              <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                Customer: {selectedDelivery?.order?.user?.full_name}
              </p>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", color: "#334155" }}>
                Select Delivery Partner:
              </label>
              <select
                value={selectedPartner || ""}
                onChange={(e) => setSelectedPartner(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                <option value="">Choose a delivery partner...</option>
                {deliveryPartners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.full_name} - {partner.email}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={handleAssignPartner}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Assign Partner
              </button>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#e2e8f0",
                  color: "#475569",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
