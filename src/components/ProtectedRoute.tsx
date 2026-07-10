import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const { auth } = useAppStore();

  if (!auth.token || !auth.user) {
    return <Navigate to="/login" />;
  }

  if (requiredRoles && !requiredRoles.includes(auth.user.role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};
