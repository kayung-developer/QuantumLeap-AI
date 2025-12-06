// This file centralizes all API calls to the backend.
// It uses a single, configured Axios instance to ensure consistency with base URLs and authentication.

import axiosInstance from './axiosInstance';
import qs from 'qs';

// ==============================================================================
// INTEGRATIONS (e.g., MT5)
// ==============================================================================

// --- MT5 Integration ---
export const getMT5Credentials = () => {
  return axiosInstance.get('/integrations/mt5/credentials');
};

export const saveMT5Credentials = (credentials) => {
  // Ensure account_number is an integer
  return axiosInstance.post('/integrations/mt5/credentials', {
      ...credentials,
      account_number: parseInt(credentials.account_number, 10)
  });
};

export const testMT5Connection = (credentials) => {
  // The backend for test also expects an integer
  return axiosInstance.post('/integrations/mt5/connect', {
      ...credentials,
      account_number: parseInt(credentials.account_number, 10)
  });
};

// FIXED: MT5 Logging Endpoint
export const logMt5Trade = (signalData) => {
    // backend expects: bot_id, symbol, action, price, volume, order_id
    return axiosInstance.post('/integrations/mt5/trade', signalData);
};


// ==============================================================================
// AUTHENTICATION
// ==============================================================================
export const registerUser = (email, password) => axiosInstance.post('/auth/register', { email, password });
export const loginWithFirebaseToken = (idToken) => axiosInstance.post('/auth/token', { id_token: idToken });
export const superuserLogin = (email, password) => axiosInstance.post('/auth/superuser/login', { email, password });

// --- Two-Factor Authentication (FIXED: Now uses the correct axiosInstance) ---
export const setupTwoFactor = () => axiosInstance.post('/auth/2fa/setup');
export const verifyTwoFactor = (data) => axiosInstance.post('/auth/2fa/verify', data); // e.g., { token: '123456' }
export const loginWithTwoFactor = (data) => axiosInstance.post('/auth/2fa/login', data); // e.g., { two_factor_token: '...', token: '...' }

// ==============================================================================
// USER & PROFILE
// ==============================================================================
export const fetchUserProfile = () => axiosInstance.get('/users/me');
export const fetchFullUserProfile = () => axiosInstance.get('/users/me/full');
export const updateUserProfile = (profileData) => axiosInstance.put('/users/me/profile', profileData);
export const uploadProfilePicture = (formData) => axiosInstance.post('/users/me/profile/picture', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getTelegramLinkCode = () => axiosInstance.get('/users/me/telegram/link');
export const fetchUserPortfolio = () => axiosInstance.get('/users/me/portfolio');
export const fetchMySubscriptions = () => axiosInstance.get('/users/me/subscriptions');

// ==============================================================================
// API KEYS
// ==============================================================================
// --- Exchange API Keys ---
export const fetchUserApiKeys = () => axiosInstance.get('/users/api-keys');
export const addUserApiKey = (exchange, apiKey, secretKey, assetClass) => {
  return axiosInstance.post('/users/api-keys', {
    exchange,
    api_key: apiKey,
    secret_key: secretKey,
    asset_class: assetClass
  });
};
export const deleteUserApiKey = (keyId) => axiosInstance.delete(`/users/api-keys/${keyId}`);

// --- Platform API Keys ---
export const fetchPlatformApiKeys = () => axiosInstance.get('/users/platform-api-keys');
export const createPlatformApiKey = () => axiosInstance.post('/users/platform-api-keys');
export const deletePlatformApiKey = (keyId) => axiosInstance.delete(`/users/platform-api-keys/${keyId}`);

// ==============================================================================
// TRADING BOTS
// ==============================================================================
// (FIXED: Removed inconsistent trailing slashes)
export const fetchUserBots = () => axiosInstance.get('/bots');
export const fetchBotDetails = (botId) => axiosInstance.get(`/bots/${botId}`);
export const createBot = (botData) => axiosInstance.post('/bots', botData);
export const updateBot = ({ botId, botData }) => {
  // We use a PUT request and include the bot's ID in the URL.
  return axiosInstance.put(`/bots/${botId}`, botData);
};
export const startBot = (botId) => axiosInstance.post(`/bots/${botId}/start`);
export const stopBot = (botId) => axiosInstance.post(`/bots/${botId}/stop`);
export const deleteBot = (botId) => axiosInstance.delete(`/bots/${botId}`);
export const fetchBotLogs = (botId) => axiosInstance.get(`/bots/${botId}/logs`);
export const fetchMyTradeLogs = (params) => {
  // Use URLSearchParams to easily construct the query string
  const queryParams = new URLSearchParams(params).toString();
  return axiosInstance.get(`/users/me/trade-logs?${queryParams}`);
};

// ==============================================================================
// STRATEGY LAB & MARKETPLACE
// ==============================================================================
export const compareStrategies = (requestData) => axiosInstance.post('/market/strategies/compare', requestData);
export const startOptimization = (requestData) => axiosInstance.post('/market/strategies/optimize', requestData);
export const getOptimizationStatus = (taskId) => axiosInstance.get(`/market/strategies/optimize/status/${taskId}`);
export const runSingleBacktest = (backtestData) => axiosInstance.post('/market/strategies/backtest', backtestData);
export const publishBot = (botId, data) => axiosInstance.patch(`/bots/${botId}/publish`, data);
export const getMarketplaceStrategies = () => axiosInstance.get('/strategies/marketplace');
export const cloneStrategy = (botId) => axiosInstance.post(`/strategies/${botId}/clone`);
// (FIXED: Removed duplicate function)
export const interpretStrategy = (text, history) => axiosInstance.post('/market/strategies/interpret', { text, history });
export const getStrategySenseiResponse = (message, history) => {
  return axiosInstance.post('/market/strategies/interpret', { message, history });
};
// ==============================================================================
// MARKET DATA & AI
// ==============================================================================
export const fetchRealtimePrice = (exchange, symbol) => axiosInstance.get(`/market/price/${exchange}/${symbol}`);
export const fetchMarketSentiment = (cryptoName) => axiosInstance.get(`/market/sentiment/${cryptoName}`);
export const getCopilotAnalysis = (exchange, symbol) => axiosInstance.get(`/market/analysis/copilot/${exchange}/${symbol}`);
export const fetchMarketTicker = (symbols) => {
    // Pass the array of symbols to the backend.
    // We use 'qs' to format the array correctly for the GET request query string.
    return axiosInstance.get('/public/market-ticker', {
        params: { symbols },
        paramsSerializer: params => {
            return qs.stringify(params, { arrayFormat: 'repeat' })
        }
    });
};

// --- General-purpose Chat Assistant ---
export const askChatAssistant = (message, history) => {
    return axiosInstance.post('/public/chat', { message, history });
};

// ==============================================================================
// MANUAL TRADING
// ==============================================================================
export const placeManualOrder = (orderData) => axiosInstance.post('/trading/orders', orderData);
export const getOpenOrders = (exchange, symbol) => axiosInstance.get(`/trading/orders/${exchange}/${symbol}`);

// ==============================================================================
// PAYMENTS & SUBSCRIPTIONS
// ==============================================================================
export const initializePayment = (plan, gateway) => axiosInstance.post(`/payments/initialize?gateway=${gateway}`, { plan });

// ==============================================================================
// WALLET & CUSTODIAL SERVICES
// ==============================================================================
export const fetchWalletBalances = () => axiosInstance.get('/wallet/balances');
export const fetchTransactions = () => axiosInstance.get('/wallet/transactions');
export const getDepositAddress = (asset) => axiosInstance.get(`/wallet/deposit/address/${asset}`);
export const getSwapQuote = (fromAsset, toAsset, amount) =>
    axiosInstance.post('/wallet/swap/quote', { from_asset: fromAsset, to_asset: toAsset, amount });
export const executeSwap = (quoteId) =>
    axiosInstance.post('/wallet/swap/execute', { quote_id: quoteId });

// ==============================================================================
// SUPERUSER
// ==============================================================================
export const fetchSystemStats = () => axiosInstance.get('/superuser/dashboard/stats');
export const fetchAllUsers = () => axiosInstance.get('/superuser/users');
export const createUserByAdmin = (userData) => axiosInstance.post('/superuser/users', userData);
export const updateUserByAdmin = (userId, updateData) => axiosInstance.patch(`/superuser/users/${userId}`, updateData);
export const impersonateUser = (userId) => axiosInstance.post(`/superuser/users/${userId}/impersonate`);
export const triggerEmergencyKillSwitch = () => axiosInstance.post('/superuser/emergency/kill-all-bots');
export const changeUserPlan = (userId, plan) => axiosInstance.patch(`/superuser/users/${userId}/plan`, { plan });
export const deleteUser = (userId) => axiosInstance.delete(`/superuser/users/${userId}`);
export const fetchSuperuserNotifications = () => axiosInstance.get('/superuser/notifications');
// --- Superuser Serial Management ---
export const fetchAllSerialNumbers = () => {
    return axiosInstance.get('/superuser/serials');
};

export const generateSerialNumber = (userId, plan) => {
    return axiosInstance.post('/superuser/serials/generate', {
        user_id: userId,
        plan: plan
    });
};
export const deleteSerialNumber = (serialId) => {
    return axiosInstance.delete(`/superuser/serials/${serialId}`);
};
// ==============================================================================
// PUBLIC & MISC
// ==============================================================================
export const getPublicBotPerformance = (botId) => axiosInstance.get(`/public/bots/${botId}`);
export const submitContactForm = (formData) => axiosInstance.post('/public/contact', formData);
export const fetchCommunityStats = () => axiosInstance.get('/public/community-stats');

export const fetchMarketplaceStrategies = () => {
    return axiosInstance.get('/strategies/marketplace');
};

export const getPublicBotDetails = (botId) => {
    return axiosInstance.get(`/public/bots/${botId}`);
};