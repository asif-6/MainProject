import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "../styles/admin.css";


export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // later remove token etc.
    navigate("/login");
  };

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <h2>Admin Panel</h2>
          <p>Medicine Tracker</p>
        </div>

        <nav className="admin-nav">
          <NavLink to="/admin" end className="admin-link">
            Dashboard
          </NavLink>
          <NavLink to="/admin/users" className="admin-link">
            Manage Users
          </NavLink>
          <NavLink to="/admin/pharmacies" className="admin-link">
            Manage Pharmacies
          </NavLink>
          <NavLink to="/admin/medicines" className="admin-link">
            Manage Medicines
          </NavLink>
          <NavLink to="/admin/orders" className="admin-link">
            Orders
          </NavLink>
          <NavLink to="/admin/delivery" className="admin-link">
            Delivery
          </NavLink>
        </nav>

        <button className="admin-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* Main */}
      <main className="admin-main">
        <header className="admin-topbar">
          <h3>QuickMeds Management System</h3>
          <span className="admin-role-badge">ADMIN</span>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
