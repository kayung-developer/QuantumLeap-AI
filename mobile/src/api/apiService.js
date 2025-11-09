// src/api/apiService.js
import axiosInstance from './axiosInstance';

// --- Authentication ---
export const superuserLogin = (email, password) => axiosInstance.post('/auth/superuser/login', { email, password });
export const fetchFullUserProfile = () => axiosInstance.get('/users/me/full');

// --- Bot Management ---
export const fetchUserBots = () => axiosInstance.get('/bots/');
export const fetchBotDetails = (botId) => axiosInstance.get(`/bots/${botId}`);
export const fetchBotLogs = (botId) => axiosInstance.get(`/bots/${botId}/logs`);
export const startBot = (botId) => axiosInstance.post(`/bots/${botId}/start`);
export const stopBot = (botId) => axiosInstance.post(`/bots/${botId}/stop`);
export const createBot = (botData) => axiosInstance.post('/bots/', botData);

// --- Wallet & Custodial ---
export const fetchWalletBalances = () => axiosInstance.get('/wallet/balances');
export const fetchTransactions = () => axiosInstance.get('/wallet/transactions');
export const getDepositAddress = (asset) => axiosInstance.get(`/wallet/deposit/address/${asset}`);

// --- Non-Custodial Portfolio ---
export const fetchUserPortfolio = () => axiosInstance.get('/users/me/portfolio');