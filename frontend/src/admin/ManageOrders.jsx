import { useState, useEffect } from "react";

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

export default function ManageOrders() {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [orderFilter, setOrderFilter] = useState("all");
  const [formData, setFormData] = useState({
    user: "",
    pharmacy: "",
    medicine: "",
    quantity: 1,
    delivery_required: false,
    delivery_address: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, orderFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch orders, users, pharmacies, and medicines in parallel
      const [ordersRes, usersRes, pharmaciesRes, medicinesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/orders/`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/users/?role=user`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/pharmacies/`, { headers: getHeaders() }),
        fetch(`${API_BASE_URL}/medicines/`, { headers: getHeaders() })
      ]);

      if (!ordersRes.ok || !usersRes.ok || !pharmaciesRes.ok || !medicinesRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [ordersData, usersData, pharmaciesData, medicinesData] = await Promise.all([
        ordersRes.json(),
        usersRes.json(),
        pharmaciesRes.json(),
        medicinesRes.json()
      ]);

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setPharmacies(Array.isArray(pharmaciesData) ? pharmaciesData : []);
      setMedicines(Array.isArray(medicinesData) ? medicinesData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    if (orderFilter === "all") {
      return; // orders is already set to all
    }
    // For now, just show all orders since filtering logic would need backend support
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE_URL}/create-order/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create order");
      }

      const newOrder = await response.json();
      setOrders([newOrder, ...orders]);
      setSuccess("Order created successfully!");
      setFormData({
        user: "",
        pharmacy: "",
        medicine: "",
        quantity: 1,
        delivery_required: false,
        delivery_address: ""
      });
      setShowCreateForm(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ order_status: newStatus })
      });

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      const updatedOrder = await response.json();
      setOrders(orders.map(o => o.id === orderId ? updatedOrder : o));
      setSuccess("Order status updated successfully!");
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'delivered': return 'tag green';
      case 'out_for_delivery': return 'tag blue';
      case 'pharmacy_accepted': return 'tag yellow';
      case 'cancelled': return 'tag red';
      default: return 'tag';
    }
  };

  const getStatusOptions = (currentStatus) => {
    const allStatuses = [
      { value: 'pending_pharmacy_confirmation', label: 'Pending Pharmacy Confirmation' },
      { value: 'pharmacy_accepted', label: 'Pharmacy Accepted' },
      { value: 'pharmacy_rejected', label: 'Pharmacy Rejected' },
      { value: 'out_for_delivery', label: 'Out for Delivery' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'cancelled', label: 'Cancelled' }
    ];

    return allStatuses.filter(status => status.value !== currentStatus);
  };

  if (loading) {
    return (
      <div>
        <h2 className="page-title">Orders</h2>
        <div className="loading">Loading orders...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Orders</h2>
        <div className="header-actions">
          <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}>
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
          </select>
          <button
            className="btn primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Cancel' : '+ Create Order'}
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {/* Create Order Form */}
      {showCreateForm && (
        <div className="panel">
          <h3>Create New Order</h3>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group">
              <label>User *</label>
              <select
                name="user"
                value={formData.user}
                onChange={handleInputChange}
                required
              >
                <option value="">Select User</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Pharmacy *</label>
              <select
                name="pharmacy"
                value={formData.pharmacy}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Pharmacy</option>
                {pharmacies.map(pharmacy => (
                  <option key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Medicine *</label>
              <select
                name="medicine"
                value={formData.medicine}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Medicine</option>
                {medicines.map(medicine => (
                  <option key={medicine.id} value={medicine.id}>
                    {medicine.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                min="1"
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>
                <input
                  type="checkbox"
                  name="delivery_required"
                  checked={formData.delivery_required}
                  onChange={handleInputChange}
                />
                Delivery Required
              </label>
            </div>

            {formData.delivery_required && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Delivery Address *</label>
                <textarea
                  name="delivery_address"
                  value={formData.delivery_address}
                  onChange={handleInputChange}
                  required={formData.delivery_required}
                  placeholder="Enter delivery address"
                  rows="3"
                />
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn primary">
                Create Order
              </button>
              <button type="button" className="btn secondary" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Orders Table */}
      <div className="table-box">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>User</th>
              <th>Pharmacy</th>
              <th>Medicine</th>
              <th>Quantity</th>
              <th>Total Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  No orders found. Create your first order above.
                </td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={order.id}>
                  <td>{order.order_id}</td>
                  <td>{order.user?.full_name || 'N/A'}</td>
                  <td>{order.pharmacy_name || 'N/A'}</td>
                  <td>{order.medicine_name || 'N/A'}</td>
                  <td>{order.quantity}</td>
                  <td>₹{order.total_price || '0.00'}</td>
                  <td>
                    <select
                      value={order.order_status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className={getStatusBadgeClass(order.order_status)}
                    >
                      <option value={order.order_status}>
                        {order.order_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                      {getStatusOptions(order.order_status).map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <span className="date">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
