
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFinanceData } from '../hooks/useFinanceData';

// requireProfile=true (default) redirects logged-in users with an incomplete
// profile to /complete-profile. Set false on the /complete-profile route itself
// (and anywhere else that must work before profile setup is done).
const ProtectedRoute = ({ children, requireProfile = true }) => {
    const { currentUser } = useAuth();
    const { profile, loading } = useFinanceData();

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    // Demo/anonymous users skip profile completion entirely — it's a local-only preview.
    const skipCheck = !requireProfile || currentUser.isAnonymous || loading;

    if (!skipCheck) {
        if (!profile?.profileComplete) {
            return <Navigate to="/complete-profile" replace />;
        }
        if (!profile?.categoriesSelected) {
            return <Navigate to="/select-categories" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
