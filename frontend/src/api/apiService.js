import axiosInstance from './axiosInstance';

// --- Authentication ---
export const registerUser = (email, password) => axiosInstance.post('/auth/register', { email, password });
export const loginWithFirebaseToken = (idToken) => axiosInstance.post('/auth/token', { id_token: idToken });
export const superuserLogin = (email, password) => axiosInstance.post('/auth/superuser/login', { email, password });

// --- User & Profile ---
export const fetchUserProfile = () => axiosInstance.get('/users/me');
export const fetchFullUserProfile = () => axiosInstance.get('/users/me/full');
export const updateUserProfile = (profileData) => axiosInstance.put('/users/me/profile', profileData);
export const uploadProfilePicture = (formData) => axiosInstance.post('/users/me/profile/picture', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getTelegramLinkCode = () => axiosInstance.get('/users/me/telegram/link');
export const fetchUserPortfolio = () => axiosInstance.get('/users/me/portfolio');

// --- User API Keys ---
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

// --- Trading Bots ---
export const fetchUserBots = () => axiosInstance.get('/bots/');
export const fetchBotDetails = (botId) => axiosInstance.get(`/bots/${botId}`);
export const createBot = (botData) => axiosInstance.post('/bots/', botData);
export const startBot = (botId) => axiosInstance.post(`/bots/${botId}/start`);
export const stopBot = (botId) => axiosInstance.post(`/bots/${botId}/stop`);
export const deleteBot = (botId) => axiosInstance.delete(`/bots/${botId}`);
export const fetchBotLogs = (botId) => axiosInstance.get(`/bots/${botId}/logs`);

// --- Strategy Lab & Marketplace ---
export const compareStrategies = (requestData) => axiosInstance.post('/market/strategies/compare', requestData);
export const startOptimization = (requestData) => axiosInstance.post('/market/strategies/optimize', requestData);
export const getOptimizationStatus = (taskId) => axiosInstance.get(`/market/strategies/optimize/status/${taskId}`);
export const runSingleBacktest = (backtestData) => axiosInstance.post('/market/strategies/backtest', backtestData);
export const publishBot = (botId, data) => axiosInstance.patch(`/bots/${botId}/publish`, data);
export const getMarketplaceStrategies = () => axiosInstance.get('/strategies/marketplace');
export const cloneStrategy = (botId) => axiosInstance.post(`/strategies/${botId}/clone`);

// --- Market Data & AI ---
export const fetchRealtimePrice = (exchange, symbol) => axiosInstance.get(`/market/price/${exchange}/${symbol}`);
export const fetchMarketSentiment = (cryptoName) => axiosInstance.get(`/market/sentiment/${cryptoName}`);
export const getCopilotAnalysis = (exchange, symbol) => axiosInstance.get(`/market/analysis/copilot/${exchange}/${symbol}`);

// --- Manual Trading ---
export const placeManualOrder = (orderData) => axiosInstance.post('/trading/orders', orderData);
export const getOpenOrders = (exchange, symbol) => axiosInstance.get(`/trading/orders/${exchange}/${symbol}`);

// --- Payments & Subscriptions ---
export const initializePayment = (plan, gateway) => axiosInstance.post(`/payments/initialize?gateway=${gateway}`, { plan });

// --- Superuser ---
export const fetchSystemStats = () => axiosInstance.get('/superuser/dashboard/stats');
export const fetchAllUsers = () => axiosInstance.get('/superuser/users');
export const impersonateUser = (userId) => axiosInstance.post(`/superuser/users/${userId}/impersonate`);
export const triggerEmergencyKillSwitch = () => axiosInstance.post('/superuser/emergency/kill-all-bots');
export const changeUserPlan = (userId, plan) => axiosInstance.patch(`/superuser/users/${userId}/plan`, { plan });
export const deleteUser = (userId) => axiosInstance.delete(`/superuser/users/${userId}`);

// --- Public & Misc ---
export const getPublicBotPerformance = (botId) => axiosInstance.get(`/public/bots/${botId}`);
export const submitContactForm = (formData) => axiosInstance.post('/public/contact', formData);

// --- NEW: Wallet & Custodial Services ---
export const fetchWalletBalances = () => axiosInstance.get('/wallet/balances');
export const fetchTransactions = () => axiosInstance.get('/wallet/transactions');
export const getDepositAddress = (asset) => axiosInstance.get(`/wallet/deposit/address/${asset}`);
export const getSwapQuote = (fromAsset, toAsset, amount) =>
    axiosInstance.post('/wallet/swap/quote', { from_asset: fromAsset, to_asset: toAsset, amount });
export const executeSwap = (quoteId) =>
    axiosInstance.post('/wallet/swap/execute', { quote_id: quoteId });


export const createUserByAdmin = (userData) => axiosInstance.post('/superuser/users', userData);
export const updateUserByAdmin = (userId, updateData) => axiosInstance.patch(`/superuser/users/${userId}`, updateData);


export const fetchMySubscriptions = () => axiosInstance.get('/users/me/subscriptions');
export const interpretStrategy = (text, history) => axiosInstance.post('/market/strategies/interpret', { text, history });
//export const interpretStrategy = (text, history) => axiosInstance.post('/market/strategies/interpret', { text, history });


export const fetchCommunityStats = () => axiosInstance.get('/public/community-stats');

export const fetchMarketTicker = () => axiosInstance.get('/public/market-ticker');

// --- NEW: Function for the general-purpose Chat Assistant ---
export const askChatAssistant = (message, history) => {
    // Note: This calls a different endpoint that does not send the auth token.
    return axiosInstance.post('/public/chat', {
        message: message,
        history: history
    });
};
export const fetchSuperuserNotifications = () => axiosInstance.get('/superuser/notifications');
