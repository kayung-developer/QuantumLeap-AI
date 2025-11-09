// src/store/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { superuserLogin, fetchFullUserProfile } from '../api/apiService';
import { setAuthToken, getAuthToken, clearAuthToken } from '../services/authStorage';
import axiosInstance from '../api/axiosInstance';

// Thunk to check for a session on app startup
export const checkAuthSession = createAsyncThunk('auth/checkSession', async (_, { rejectWithValue }) => {
  const token = await getAuthToken();
  if (!token) return rejectWithValue('No token found');
  axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  try {
    const response = await fetchFullUserProfile();
    return { token, profile: response.data };
  } catch (error) {
    await clearAuthToken();
    return rejectWithValue('Invalid token');
  }
});

// Thunk for the login action
export const loginUser = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const response = await superuserLogin(email, password); // Using superuser for simplicity
    const { access_token } = response.data;
    await setAuthToken(access_token);
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    const profileResponse = await fetchFullUserProfile();
    return { token: access_token, profile: profileResponse.data };
  } catch (error) {
    return rejectWithValue(error.response?.data?.detail || 'Login failed. Please check your credentials.');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    accessToken: null,
    profile: null,
    isAuthenticated: false,
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.accessToken = null;
      state.profile = null;
      state.isAuthenticated = false;
      state.status = 'idle';
      clearAuthToken();
      delete axiosInstance.defaults.headers.common['Authorization'];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuthSession.pending, (state) => { state.status = 'loading'; })
      .addCase(checkAuthSession.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isAuthenticated = true;
        state.accessToken = action.payload.token;
        state.profile = action.payload.profile;
      })
      .addCase(checkAuthSession.rejected, (state) => {
        state.status = 'idle';
        state.isAuthenticated = false;
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isAuthenticated = true;
        state.accessToken = action.payload.token;
        state.profile = action.payload.profile;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;