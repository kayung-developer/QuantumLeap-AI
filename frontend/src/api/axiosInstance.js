import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const axiosInstance = axios.create({
  // We append '/api' to the base URL here.
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add the auth token to every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


// Interceptor to handle token expiration and refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if the error is a 401 and not a retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // --- NEW: Check for the specific "account update" message ---
      // This is the key to our new logic.
      const isForcedLogout = error.response.data?.detail === "Your session has expired due to an account update. Please log in again.";

      if (isForcedLogout) {
        // If the backend has deliberately invalidated this session,
        // we must log the user out immediately.
        console.log("Forced logout due to account update.");
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login?reason=account_updated'; // Use a more specific reason
        return Promise.reject(error); // Reject the promise to stop further action
      }

      // --- EXISTING LOGIC: If it's not a forced logout, proceed with token refresh ---
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          console.log("Access token expired. Attempting to refresh...");
          // Use the public axios instance for the refresh request to avoid an infinite loop
          const { data } = await axios.post(`${axiosInstance.defaults.baseURL}/auth/token/refresh`, {
            refresh_token: refreshToken
          });

          localStorage.setItem('accessToken', data.access_token);
          localStorage.setItem('refreshToken', data.refresh_token);

          // Update the headers for the original request and any subsequent requests
          axiosInstance.defaults.headers.common['Authorization'] = 'Bearer ' + data.access_token;
          originalRequest.headers['Authorization'] = 'Bearer ' + data.access_token;

          return axiosInstance(originalRequest);
        } catch (refreshError) {
          // If the refresh token itself is invalid, log the user out.
          console.log("Refresh token is invalid. Logging out.");
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login?reason=session_expired';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token available, send to login.
        console.log("No refresh token. Logging out.");
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    // For all other errors, just pass them along.
    return Promise.reject(error);
  }
);

export const getErrorMessage = (error) => {
    if (error.response) {
      return error.response.data?.detail || `Server Error: ${error.response.status}`;
    } else if (error.request) {
      return "Network Error: Could not connect to the server. Please check your connection.";
    } else {
      return error.message || "An unknown error occurred.";
    }
};


export default axiosInstance;