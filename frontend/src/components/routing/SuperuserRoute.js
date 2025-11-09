// src/components/routing/SuperuserRoute.js

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const SuperuserRoute = ({ children }) => {
    // We don't need to check for 'loading' or 'isAuthenticated' here
    // because this component will always be nested inside a ProtectedRoute.
    const { profile } = useAuth();

    return profile?.role === 'superuser' ? children : <Navigate to="/dashboard" replace />;
};

export default SuperuserRoute;