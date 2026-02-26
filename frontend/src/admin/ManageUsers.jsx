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

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "user"
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (roleFilter === "all") {
      setFilteredUsers(users);
    } else {
      setFilteredUsers(users.filter(user => user.role === roleFilter));
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
      email: "",
      full_name: "",
      password: "",
      role: "user"
    });
    setEditingUser(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const url = editingUser
        ? `${API_BASE_URL}/users/${editingUser.id}/`
        : `${API_BASE_URL}/users/`;

      const method = editingUser ? "PUT" : "POST";

      const submitData = editingUser
        ? { email: formData.email, full_name: formData.full_name, role: formData.role }
        : formData;

      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save user");
      }

      const savedUser = await response.json();
      setSuccess(editingUser ? "User updated successfully!" : "User created successfully!");

      if (editingUser) {
        setUsers(users.map(user => user.id === editingUser.id ? savedUser : user));
      } else {
        setUsers([...users, savedUser]);
      }

      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      password: "",
      role: user.role
    });
    setShowAddForm(true);
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete ${userName}?`)) {
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/users/${userId}/`, {
        method: "DELETE",
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete user");
      }

      setUsers(users.filter(user => user.id !== userId));
      setSuccess("User deleted successfully!");
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleUserStatus = async (user) => {
    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/users/${user.id}/`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ is_active: !user.is_active })
      });

      if (!response.ok) {
        throw new Error("Failed to update user status");
      }

      const updatedUser = await response.json();
      setUsers(users.map(u => u.id === user.id ? updatedUser : u));
      setSuccess(`User ${updatedUser.is_active ? 'activated' : 'deactivated'} successfully!`);
    } catch (err) {
      setError(err.message);
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin': return 'badge-admin';
      case 'pharmacy': return 'badge-pharmacy';
      case 'delivery': return 'badge-delivery';
      default: return 'badge-user';
    }
  };

  const getStatusBadgeClass = (isActive) => {
    return isActive ? 'tag green' : 'tag red';
  };

  if (loading) {
    return (
      <div>
        <h2 className="page-title">Manage Users</h2>
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Manage Users</h2>
        <button
          className="btn primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add New User'}
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {/* Add/Edit User Form */}
      {showAddForm && (
        <div className="panel">
          <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                required
                placeholder="Enter full name"
              />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="Enter email address"
              />
            </div>

            {!editingUser && (
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter password"
                  minLength="6"
                />
              </div>
            )}

            <div className="form-group">
              <label>Role *</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
              >
                <option value="user">Regular User</option>
                <option value="pharmacy">Pharmacy Partner</option>
                <option value="delivery">Delivery Partner</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                {editingUser ? 'Update User' : 'Create User'}
              </button>
              <button type="button" className="btn secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Filter by Role:</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="admin">Administrators</option>
            <option value="user">Regular Users</option>
            <option value="pharmacy">Pharmacy Partners</option>
            <option value="delivery">Delivery Partners</option>
          </select>
        </div>
        <div className="stats">
          Total Users: {filteredUsers.length}
        </div>
      </div>

      {/* Users Table */}
      <div className="table-box">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Quick Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  {roleFilter === "all" ? "No users found" : `No ${roleFilter} users found`}
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td>
                    <span className={getStatusBadgeClass(user.is_active)}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn small"
                        onClick={() => handleEdit(user)}
                        title="Edit User"
                      >
                        ✏️
                      </button>
                      <button
                        className={`btn small ${user.is_active ? 'warning' : 'success'}`}
                        onClick={() => toggleUserStatus(user)}
                        title={user.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {user.is_active ? '🚫' : '✅'}
                      </button>
                      <button
                        className="btn small danger"
                        onClick={() => handleDelete(user.id, user.full_name)}
                        title="Delete User"
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
