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

export default function ManageMedicines() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    generic_name: "",
    dosage: "",
    unit: "",
    description: ""
  });

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/medicines/`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error("Failed to fetch medicines");
      }

      const data = await response.json();
      setMedicines(Array.isArray(data) ? data : []);
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

  const resetForm = () => {
    setFormData({
      name: "",
      generic_name: "",
      dosage: "",
      unit: "",
      description: ""
    });
    setEditingMedicine(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const url = editingMedicine
        ? `${API_BASE_URL}/medicines/${editingMedicine.id}/`
        : `${API_BASE_URL}/medicines/`;

      const method = editingMedicine ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save medicine");
      }

      const savedMedicine = await response.json();
      setSuccess(editingMedicine ? "Medicine updated successfully!" : "Medicine created successfully!");

      if (editingMedicine) {
        setMedicines(medicines.map(m => m.id === editingMedicine.id ? savedMedicine : m));
      } else {
        setMedicines([...medicines, savedMedicine]);
      }

      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (medicine) => {
    setEditingMedicine(medicine);
    setFormData({
      name: medicine.name,
      generic_name: medicine.generic_name || "",
      dosage: medicine.dosage || "",
      unit: medicine.unit || "",
      description: medicine.description || ""
    });
    setShowAddForm(true);
  };

  const deleteMedicine = async (medicineId, medicineName) => {
    if (!window.confirm(`Are you sure you want to delete ${medicineName}?`)) {
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/medicines/${medicineId}/`, {
        method: "DELETE",
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error("Failed to delete medicine");
      }

      setMedicines(medicines.filter(m => m.id !== medicineId));
      setSuccess("Medicine deleted successfully!");
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="page-title">Manage Medicines</h2>
        <div className="loading">Loading medicines...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Manage Medicines</h2>
        <button
          className="btn primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add Medicine'}
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {/* Add/Edit Medicine Form */}
      {showAddForm && (
        <div className="panel">
          <h3>{editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}</h3>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group">
              <label>Medicine Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Enter medicine name"
              />
            </div>

            <div className="form-group">
              <label>Generic Name</label>
              <input
                type="text"
                name="generic_name"
                value={formData.generic_name}
                onChange={handleInputChange}
                placeholder="Enter generic name (optional)"
              />
            </div>

            <div className="form-group">
              <label>Dosage</label>
              <input
                type="text"
                name="dosage"
                value={formData.dosage}
                onChange={handleInputChange}
                placeholder="e.g., 500mg, 10ml"
              />
            </div>

            <div className="form-group">
              <label>Unit</label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                placeholder="e.g., tablets, syrup"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter medicine description (optional)"
                rows="3"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                {editingMedicine ? 'Update Medicine' : 'Create Medicine'}
              </button>
              <button type="button" className="btn secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Medicines Table */}
      <div className="table-box">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Generic Name</th>
              <th>Dosage</th>
              <th>Unit</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {medicines.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  No medicines found. Add your first medicine above.
                </td>
              </tr>
            ) : (
              medicines.map(medicine => (
                <tr key={medicine.id}>
                  <td>{medicine.name}</td>
                  <td>{medicine.generic_name || 'N/A'}</td>
                  <td>{medicine.dosage || 'N/A'}</td>
                  <td>{medicine.unit || 'N/A'}</td>
                  <td>
                    {medicine.description
                      ? medicine.description.length > 50
                        ? `${medicine.description.substring(0, 50)}...`
                        : medicine.description
                      : 'N/A'
                    }
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn small"
                        onClick={() => handleEdit(medicine)}
                        title="Edit Medicine"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn small danger"
                        onClick={() => deleteMedicine(medicine.id, medicine.name)}
                        title="Delete Medicine"
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
