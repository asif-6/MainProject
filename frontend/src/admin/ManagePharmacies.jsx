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

export default function ManagePharmacies() {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    license_number: ""
  });

  useEffect(() => {
    fetchPharmacies();
  }, []);

  const fetchPharmacies = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/pharmacies/`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error("Failed to fetch pharmacies");
      }

      const data = await response.json();
      setPharmacies(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE_URL}/pharmacies/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create pharmacy");
      }

      const newPharmacy = await response.json();
      setPharmacies([...pharmacies, newPharmacy]);
      setSuccess("Pharmacy created successfully!");
      setFormData({ name: "", address: "", phone: "", license_number: "" });
      setShowAddForm(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleVerification = async (pharmacyId, currentStatus) => {
    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/pharmacies/${pharmacyId}/`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ is_verified: !currentStatus })
      });

      if (!response.ok) {
        throw new Error("Failed to update pharmacy status");
      }

      const updatedPharmacy = await response.json();
      setPharmacies(pharmacies.map(p => p.id === pharmacyId ? updatedPharmacy : p));
      setSuccess(`Pharmacy ${updatedPharmacy.is_verified ? 'verified' : 'unverified'} successfully!`);
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePharmacy = async (pharmacyId, pharmacyName) => {
    if (!window.confirm(`Are you sure you want to delete ${pharmacyName}?`)) {
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/pharmacies/${pharmacyId}/`, {
        method: "DELETE",
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error("Failed to delete pharmacy");
      }

      setPharmacies(pharmacies.filter(p => p.id !== pharmacyId));
      setSuccess("Pharmacy deleted successfully!");
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusBadge = (isVerified) => {
    return isVerified ? 'tag green' : 'tag yellow';
  };

  if (loading) {
    return (
      <div>
        <h2 className="page-title">Manage Pharmacies</h2>
        <div className="loading">Loading pharmacies...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Manage Pharmacies</h2>
        <button
          className="btn primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add Pharmacy'}
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {/* Add Pharmacy Form */}
      {showAddForm && (
        <div className="panel">
          <h3>Add New Pharmacy</h3>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group">
              <label>Pharmacy Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Enter pharmacy name"
              />
            </div>

            <div className="form-group">
              <label>Address *</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                placeholder="Enter full address"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Phone *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                placeholder="Enter phone number"
              />
            </div>

            <div className="form-group">
              <label>License Number *</label>
              <input
                type="text"
                name="license_number"
                value={formData.license_number}
                onChange={handleInputChange}
                required
                placeholder="Enter license number"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                Create Pharmacy
              </button>
              <button type="button" className="btn secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pharmacies Table */}
      <div className="table-box">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Pharmacy</th>
              <th>Address</th>
              <th>Phone</th>
              <th>License</th>
              <th>Status</th>
              <th>Medicines</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pharmacies.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  No pharmacies found. Add your first pharmacy above.
                </td>
              </tr>
            ) : (
              pharmacies.map(pharmacy => (
                <tr key={pharmacy.id}>
                  <td>{pharmacy.name}</td>
                  <td>{pharmacy.address}</td>
                  <td>{pharmacy.phone}</td>
                  <td>{pharmacy.license_number || 'N/A'}</td>
                  <td>
                    <span className={getStatusBadge(pharmacy.is_verified)}>
                      {pharmacy.is_verified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td>{pharmacy.medicines?.length || 0} medicines</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className={`btn small ${pharmacy.is_verified ? 'warning' : 'success'}`}
                        onClick={() => toggleVerification(pharmacy.id, pharmacy.is_verified)}
                        title={pharmacy.is_verified ? 'Unverify' : 'Verify'}
                      >
                        {pharmacy.is_verified ? '🚫' : '✅'}
                      </button>
                      <button
                        className="btn small danger"
                        onClick={() => deletePharmacy(pharmacy.id, pharmacy.name)}
                        title="Delete Pharmacy"
                      >
                        🗑️
                      </button>
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
