import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';


// Layouts
import DashboardLayout from './components/layout/DashboardLayout';
import MarketplacePage from './pages/MarketplacePage';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BotsPage from './pages/BotsPage';
import BotDetailPage from './pages/BotDetailPage';
import MarketPage from './pages/MarketPage';
import SettingsPage from './pages/SettingsPage';
import BillingPage from './pages/BillingPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import SuperuserDashboard from './pages/SuperuserDashboard';
import StrategyLabPage from './pages/StrategyLabPage';

import PublicBotPage from './pages/PublicBotPage';

// --- IMPORT THE NEW LEGAL & CONTACT PAGES ---
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ContactPage from './pages/ContactPage';

import ApiKeysPage from './pages/ApiKeysPage';

import WalletPage from './pages/WalletPage';

import StrategyBuilderPage from './pages/StrategyBuilderPage';

// --- Reusable Route Protection Components ---
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    // Don't render anything until the initial auth check is done
    if (loading) return null;
    return isAuthenticated ? children : <Navigate to="/login" />;
};

const SuperuserRoute = ({ children }) => {
    const { isAuthenticated, profile } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" />;
    return profile?.role === 'superuser' ? children : <Navigate to="/dashboard" />;
};

function App() {
    return (
        <>
            <Toaster position="top-right" toastOptions={{ style: { background: '#161B22', color: '#C9D1D9', border: '1px solid #30363D' }}} />
            <AnimatePresence mode="wait">
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    {/* --- NEWLY ADDED PUBLIC PAGES --- */}
                    <Route path="/terms" element={<TermsOfServicePage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="/contact" element={<ContactPage />} />

                    {/* Protected Dashboard Routes */}
                    <Route path="/dashboard/*" element={
                        <ProtectedRoute>
                            <WebSocketProvider>
                                <Routes>
                                    <Route path="/" element={<DashboardLayout />}>
                                        <Route index element={<DashboardPage />} />
                                        <Route path="bots" element={<BotsPage />} />
                                        <Route path="bots/:botId" element={<BotDetailPage />} />
                                        <Route path="wallet" element={<WalletPage />} />
                                        <Route path="market" element={<MarketPage />} />
                                        <Route path="marketplace" element={<MarketplacePage />} />
                                        <Route path="strategy-lab" element={<StrategyLabPage />} />
                                        <Route path="builder" element={<StrategyBuilderPage />} />
                                        <Route path="billing" element={<BillingPage />} />
                                        <Route path="settings" element={<SettingsPage />} />
                                        <Route path="api-keys" element={<ApiKeysPage />} />
                                        <Route path="admin" element={
                                            <SuperuserRoute>
                                                <SuperuserDashboard />
                                            </SuperuserRoute>
                                        }/>
                                        <Route path="superuser" element={<SuperuserDashboard />} />
                                    </Route>
                                </Routes>
                            </WebSocketProvider>
                        </ProtectedRoute>
                    }/>

                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </AnimatePresence>
        </>
    );
}

export default App;