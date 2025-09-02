// src/contexts/AuthContext.js

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup } from 'firebase/auth';
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
    const [loading, setLoading] = useState(true); // Manages the initial session check on app load
    const navigate = useNavigate();
    const location = useLocation();


    // --- EFFECT TO HANDLE SESSION RESTORATION ON APP LOAD ---
    useEffect(() => {
        const restoreSession = async () => {
            const tokenInStorage = localStorage.getItem('accessToken');
            if (!tokenInStorage) {
                setLoading(false);
                return; // No token, no session to restore
            }

            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${tokenInStorage}`;
            try {
                const profileResponse = await fetchFullUserProfile();
                setProfile(profileResponse.data);
                setAccessToken(tokenInStorage);
            } catch (error) {
                // Token is invalid, clear everything
                localStorage.removeItem('accessToken');
                console.error("Session restore failed, token invalid.", error);
            } finally {
                setLoading(false);
            }
        };
        restoreSession();
    }, []);

    // --- UNIFIED SUCCESS HANDLER ---
    const handleLoginSuccess = useCallback(async (token) => {
        localStorage.setItem('accessToken', token);
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const profileResponse = await fetchFullUserProfile();

        setAccessToken(token);
        setProfile(profileResponse.data);

        // Redirect after successful login
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
    }, [navigate, location.state]);

    // --- AUTHENTICATION ACTIONS ---

    const login = async (email, password) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await userCredential.user.getIdToken(true);
        const response = await loginWithFirebaseToken(idToken);
        await handleLoginSuccess(response.data.access_token);
    };

    const register = async (email, password) => {
        await registerUser(email, password);
        // After registering, perform a full login to create the session
        await login(email, password);
    };

    const googleSignIn = async () => {
        const userCredential = await signInWithPopup(auth, googleProvider);
        const idToken = await userCredential.user.getIdToken(true);
        const response = await loginWithFirebaseToken(idToken);
        await handleLoginSuccess(response.data.access_token);
    };

    const adminLogin = async (email, password) => {
        const { data } = await superuserLogin(email, password);
        await handleLoginSuccess(data.access_token);
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
            localStorage.removeItem('refreshToken');
            setAccessToken(null);
            setProfile(null);
            delete axiosInstance.defaults.headers.common['Authorization'];
            // Navigate to login page on logout to ensure clean state
            navigate('/login');
        }
    }, [navigate]);

    // This is still useful for real-time updates from WebSockets
    const updateProfile = useCallback((newProfileData) => {
        setProfile(prev => ({ ...prev, ...newProfileData }));
    }, []);
        // --- NEW: A dedicated function to refetch the profile ---
    const refetchProfile = useCallback(async () => {
        try {
            const profileResponse = await fetchFullUserProfile();
            setProfile(profileResponse.data);
        } catch (error) {
            console.error("Failed to refetch profile:", error);
        }
    }, []);


    // Show a spinner ONLY on the initial app load while checking for a session.
    if (loading) {
        return <div className="min-h-screen bg-primary flex items-center justify-center"><Spinner size="lg" /></div>;
    }

    return (
        <AuthContext.Provider value={{ profile, isAuthenticated: !!accessToken, loading, login, register, adminLogin, googleSignIn, logout, updateProfile, refetchProfile }}>
            {children}
        </AuthContext.Provider>
    );
};