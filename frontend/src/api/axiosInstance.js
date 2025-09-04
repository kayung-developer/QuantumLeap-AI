import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: `${process.env.REACT_APP_API_BASE_URL}/api`, // Your FastAPI backend URL
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
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('https://quantumleap-ai.onrender.com/api/auth/token/refresh', {
            refresh_token: refreshToken
          });
          localStorage.setItem('accessToken', data.access_token);
          localStorage.setItem('refreshToken', data.refresh_token);
          axiosInstance.defaults.headers.common['Authorization'] = 'Bearer ' + data.access_token;
          originalRequest.headers['Authorization'] = 'Bearer ' + data.access_token;
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          // If refresh fails, clear tokens and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          // This will trigger the auth context to update and redirect
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, redirect to login
        window.location.href = '/login';
      }
    }
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

