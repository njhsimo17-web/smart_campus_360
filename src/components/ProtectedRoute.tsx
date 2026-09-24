import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { currentUser, userData, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-500" />
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user's role is allowed
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on role
    if (userRole === 'student') {
      return <Navigate to="/student/dashboard" replace />;
    } else if (userRole === 'professor') {
      return <Navigate to="/professor/dashboard" replace />;
    } else if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Check if user status is approved (for students)
  const isPendingApproval = userData?.status === 'pending' || userData?.status === 'Pending Approval';
  const isRejected = userData?.status === 'rejected' || userData?.status === 'Rejected';
  if (userRole === 'student' && isRejected) {
    return <Navigate to="/login" replace />;
  }
  if (userRole === 'student' && isPendingApproval) {
    return <Navigate to="/registration-pending" replace />;
  }

  // Professor pages are available only to explicitly active professor accounts.
  // Role checks alone are not sufficient because inactive staff may still authenticate.
  const normalizedStatus = String(userData?.status ?? '').trim().toLowerCase();
  if (userRole === 'professor' && normalizedStatus !== 'active') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
