// src/components/routing/ProtectedRoute.js

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../common/Spinner';

const ProtectedRoute = ({ children }) => {
    // This will now work because this component will be a child of AuthProvider
    const { isAuthenticated, loading } = useAuth();

    // While the context is checking for a session, show a loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-light-primary dark:bg-primary flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    // After checking, if not authenticated, redirect to login
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;