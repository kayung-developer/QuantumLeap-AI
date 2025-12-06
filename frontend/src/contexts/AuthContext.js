// src/contexts/AuthContext.js

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, signOut, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../api/firebase';
import { loginWithFirebaseToken, fetchFullUserProfile, registerUser, superuserLogin } from '../api/apiService';
import axiosInstance from '../api/axiosInstance';
import Spinner from '../components/common/Spinner';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [profile, setProfile] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    // --- EFFECT TO HANDLE SESSION RESTORATION ON APP LOAD ---
    useEffect(() => {
        const restoreSession = async () => {
            const tokenInStorage = localStorage.getItem('accessToken');
            if (!tokenInStorage) {
                setLoading(false);
                return;
            }

            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${tokenInStorage}`;
            try {
                const profileResponse = await fetchFullUserProfile();
                setProfile(profileResponse.data);
                setAccessToken(tokenInStorage);
            } catch (error) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                console.error("Session restore failed, token invalid.", error);
            } finally {
                setLoading(false);
            }
        };
        restoreSession();
    }, []);

    // --- UNIFIED SUCCESS HANDLER (MODIFIED & EXPOSED) ---
    const handleLoginSuccess = useCallback(async (data) => {
        // Expects data = { access_token: '...', refresh_token: '...' }
        if (!data || !data.access_token) {
            console.error("handleLoginSuccess was called with invalid data.");
            // Optionally, handle this error more gracefully
            return;
        }

        localStorage.setItem('accessToken', data.access_token);
        localStorage.setItem('refreshToken', data.refresh_token); // Store refresh token
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;

        const profileResponse = await fetchFullUserProfile();
        setAccessToken(data.access_token);
        setProfile(profileResponse.data);

        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
    }, [navigate, location.state]);


    // --- AUTHENTICATION ACTIONS (MODIFIED FOR 2FA) ---

    const login = async (email, password) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await userCredential.user.getIdToken(true);
        const response = await loginWithFirebaseToken(idToken);

        // If login is direct (no 2FA), handle success now.
        if (response.status === 200) {
            await handleLoginSuccess(response.data);
        }

        // ALWAYS return the response so LoginPage can check for a 2FA challenge (status 202)
        return response;
    };

    const register = async (email, password) => {
        await registerUser(email, password);
        // After registering, return the login promise. LoginPage will handle the response.
        return login(email, password);
    };

    const googleSignIn = async () => {
        const userCredential = await signInWithPopup(auth, googleProvider);
        const idToken = await userCredential.user.getIdToken(true);
        const response = await loginWithFirebaseToken(idToken);

        // If login is direct, handle success now.
        if (response.status === 200) {
            await handleLoginSuccess(response.data);
        }

        // Return the response for LoginPage to inspect
        return response;
    };

    const adminLogin = async (email, password) => {
        const { data } = await superuserLogin(email, password);
        // Admin login doesn't have a 2FA step, so it can complete here.
        await handleLoginSuccess(data);
        // We still return a response-like object for consistency in handleAuthAction
        return { status: 200, data };
    };

    const logout = useCallback(async () => {
        try {
            if (auth.currentUser) {
                await signOut(auth);
            }
        } catch (error) {
            console.error("Firebase signout error:", error);
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken'); // Also clear the refresh token
            setAccessToken(null);
            setProfile(null);
            delete axiosInstance.defaults.headers.common['Authorization'];
            navigate('/login');
        }
    }, [navigate]);

    const updateProfile = useCallback((newProfileData) => {
        setProfile(prev => ({ ...prev, ...newProfileData }));
    }, []);

    const refetchProfile = useCallback(async () => {
        try {
            const profileResponse = await fetchFullUserProfile();
            setProfile(profileResponse.data);
        } catch (error) {
            console.error("Failed to refetch profile:", error);
        }
    }, []);

    if (loading) {
        return <div className="min-h-screen bg-primary flex items-center justify-center"><Spinner size="lg" /></div>;
    }

    return (
        <AuthContext.Provider value={{
            profile,
            isAuthenticated: !!accessToken,
            loading,
            login,
            register,
            adminLogin,
            googleSignIn,
            logout,
            updateProfile,
            refetchProfile,
            handleLoginSuccess // Expose the success handler for the 2FA modal
        }}>
            {children}
        </AuthContext.Provider>
    );
};