// src/App.js

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { MarketDataProvider } from './contexts/MarketDataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Layouts & Routing
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/routing/ProtectedRoute';
import SuperuserRoute from './components/routing/SuperuserRoute';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BotsPage from './pages/BotsPage';
import TradeHistoryPage from './pages/TradeHistoryPage';
import BotDetailPage from './pages/BotDetailPage';
import WalletPage from './pages/WalletPage';
import MarketPage from './pages/MarketPage';
import IntegrationsPage from './pages/IntegrationsPage';
import MarketplacePage from './pages/MarketplacePage';
import StrategyLabPage from './pages/StrategyLabPage';
import StrategyBuilderPage from './pages/StrategyBuilderPage';
import BillingPage from './pages/BillingPage';
import SettingsPage from './pages/SettingsPage';
import ApiKeysPage from './pages/ApiKeysPage';
import SuperuserDashboard from './pages/SuperuserDashboard';
import PublicBotPage from './pages/PublicBotPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ContactPage from './pages/ContactPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicLayout from './components/layout/PublicLayout';

// --- THIS IS THE FIX ---
// 1. Define the QueryClient instance before using it.
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false, // Prevents excessive refetching
            staleTime: 1000 * 60 * 5, // Cache data for 5 minutes
        },
    },
});

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <QueryClientProvider client={queryClient}>
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            className: '',
                            style: {
                                background: '#161B22',
                                color: '#C9D1D9',
                                border: '1px solid #30363D',
                            },
                        }}
                    />
                    <AnimatePresence mode="wait">
                        <Routes>
                            {/* --- Public Routes --- */}
                            <Route element={<PublicLayout />}>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/terms" element={<TermsOfServicePage />} />
                            <Route path="/privacy" element={<PrivacyPolicyPage />} />
                            <Route path="/contact" element={<ContactPage />} />
                            <Route path="/marketplace/bot/:botId" element={<PublicBotPage />} />
                            </Route>
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            {/* --- Protected Routes --- */}
                            {/* This is the parent route for the entire dashboard */}
                            <Route
                                path="/dashboard"
                                element={
                                    <ProtectedRoute>
                                        <WebSocketProvider>
                                            <MarketDataProvider>
                                                <DashboardLayout />
                                            </MarketDataProvider>
                                        </WebSocketProvider>
                                    </ProtectedRoute>
                                }
                            >
                                {/*
                                  --- THIS IS THE FIX ---
                                  2. All nested dashboard routes are placed here, as children
                                     of the parent "/dashboard" route. They will render inside
                                     the DashboardLayout's <Outlet>.
                                */}
                                <Route index element={<DashboardPage />} />
                                <Route path="bots" element={<BotsPage />} />
                                <Route path="history" element={<TradeHistoryPage />} />
                                <Route path="bots/:botId" element={<BotDetailPage />} />
                                <Route path="wallet" element={<WalletPage />} />
                                <Route path="market" element={<MarketPage />} />
                                <Route path="integrations" element={<IntegrationsPage />} />
                                <Route path="marketplace" element={<MarketplacePage />} />
                                <Route path="strategy-lab" element={<StrategyLabPage />} />
                                <Route path="builder" element={<StrategyBuilderPage />} />
                                <Route path="billing" element={<BillingPage />} />
                                <Route path="settings" element={<SettingsPage />} />
                                <Route path="api-keys" element={<ApiKeysPage />} />

                                {/* This is the correct way to nest a protected sub-route */}
                                <Route
                                    path="admin"
                                    element={
                                        <SuperuserRoute>
                                            <SuperuserDashboard />
                                        </SuperuserRoute>
                                    }
                                />
                            </Route>

                            {/* --- Catch-all 404 Route --- */}
                            <Route path="*" element={<NotFoundPage />} />
                        </Routes>
                    </AnimatePresence>
                </QueryClientProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
