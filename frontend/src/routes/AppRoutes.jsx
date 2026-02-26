import { Routes, Route } from "react-router-dom";
import UserDashboard from "../components/UserDashboard";
import PharmacyDashboard from "../components/PharmacyDashboard";
import DeliveryDashboard from "../components/DeliveryDashboard";

// Public pages
import Home from "../components/Home";
import Login from "../components/Login";
import Signup from "../components/Signup";
import AdminLayout from "../admin/AdminLayout";
import AdminDashboard from "../admin/AdminDashboard";
import ManageUsers from "../admin/ManageUsers";
import ManagePharmacies from "../admin/ManagePharmacies";
import ManageMedicines from "../admin/ManageMedicines";
import ManageOrders from "../admin/ManageOrders";
import ManageDelivery from "../admin/ManageDelivery";


export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<UserDashboard />} />
      <Route path="/pharmacy" element={<PharmacyDashboard />} />
      <Route path="/delivery" element={<DeliveryDashboard />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<ManageUsers />} />
        <Route path="pharmacies" element={<ManagePharmacies />} />
        <Route path="medicines" element={<ManageMedicines />} />
        <Route path="orders" element={<ManageOrders />} />
        <Route path="delivery" element={<ManageDelivery />} />
      </Route>


    </Routes>
  );
}
