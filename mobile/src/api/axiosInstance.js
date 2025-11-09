// src/api/axiosInstance.js
import axios from 'axios';
import { getAuthToken } from '../services/authStorage';

const axiosInstance = axios.create({
  // IMPORTANT: For local development with a mobile device, you CANNOT use 'localhost'.
  // You must use your computer's local network IP address.
  // Find it by running 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux).
  baseURL: 'http://172.28.48.1:8000/api', // <-- REPLACE WITH YOUR COMPUTER'S IP
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;