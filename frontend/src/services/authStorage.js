// src/services/authStorage.js

// This file provides a consistent interface for storing and retrieving
// authentication tokens. It abstracts away the storage mechanism.
// For web, it's localStorage. For mobile (React Native), this would be react-native-keychain.

export const setAuthToken = (token) => {
    try {
        localStorage.setItem('accessToken', token);
    } catch (error) {
        console.error('Failed to save auth token:', error);
    }
};

export const getAuthToken = () => {
    try {
        return localStorage.getItem('accessToken');
    } catch (error) {
        console.error('Failed to retrieve auth token:', error);
        return null;
    }
};

export const clearAuthToken = () => {
    try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken'); // Also clear the refresh token
    } catch (error) {
        console.error('Failed to clear auth token:', error);
    }
};