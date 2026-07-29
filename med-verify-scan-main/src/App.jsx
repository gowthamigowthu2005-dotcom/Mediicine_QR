import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminSellerVerification from './pages/AdminSellerVerification.jsx';
import AdminMedicineManagement from './pages/AdminMedicineManagement.jsx';
import AdminAnalytics from './pages/AdminAnalytics.jsx';
import AdminAuditLogs from './pages/AdminAuditLogs.jsx';
import AdminQRCodes from './pages/AdminQRCodes.jsx';
import AdminSecurity from './pages/AdminSecurity.jsx';
import SellerDashboard from './pages/SellerDashboard.jsx';
import SellerApply from './pages/SellerApply.jsx';
import SellerStatus from './pages/SellerStatus.jsx';
import MedicineDatabase from './pages/MedicineDatabase.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import ScanMedicine from './pages/ScanMedicine.jsx';
import NotFound from './pages/NotFound.jsx';
import { ProtectedRoute } from './lib/ProtectedRoute.jsx';
import { SellerDashboardGuard } from './components/SellerDashboardGuard.jsx';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>

      <Routes>
        <Route path="/" element={<Index />} />
        <Route
          path="/scan"
          element={
            <ProtectedRoute>
              <ScanMedicine />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/admin/sellers"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminSellerVerification />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/medicines"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminMedicineManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminAnalytics />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminAuditLogs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/qr-codes"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminQRCodes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/security"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminSecurity />
            </ProtectedRoute>
          }
        />
        
        {/* Seller Routes */}
        <Route
          path="/seller/apply"
          element={
            <ProtectedRoute requiredRole="seller">
              <SellerApply />
            </ProtectedRoute>
          }
        />

        <Route
          path="/seller/status"
          element={
            <ProtectedRoute requiredRole="seller">
              <SellerStatus />
            </ProtectedRoute>
          }
        />

        <Route
          path="/seller/dashboard"
          element={
            <ProtectedRoute requiredRole="seller">
              <SellerDashboardGuard>
                <SellerDashboard />
              </SellerDashboardGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/seller/medicines"
          element={
            <ProtectedRoute requiredRole="seller">
              <SellerDashboardGuard>
                <MedicineDatabase />
              </SellerDashboardGuard>
            </ProtectedRoute>
          }
        />

        {/* User Routes */}
        <Route
          path="/user/dashboard"
          element={
            <ProtectedRoute requiredRole="user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
