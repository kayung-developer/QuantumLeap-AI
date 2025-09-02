// src/store/authSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { superuserLogin, fetchFullUserProfile } from '../api/apiService';
import { setAuthToken, getAuthToken, clearAuthToken } from '../services/authStorage';
import axiosInstance from '../api/axiosInstance';
import { signOut } from 'firebase/auth'; // Assuming firebase is configured and exported
import { auth } from '../api/firebase';


// This thunk is for a SUPERUSER login only. Regular user login is handled by the AuthProvider.
export const loginSuperuser = createAsyncThunk(
  'auth/loginSuperuser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await superuserLogin(email, password);
      const { access_token } = response.data;
      await setAuthToken(access_token);
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      const profileResponse = await fetchFullUserProfile();
      return { token: access_token, profile: profileResponse.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Login failed.');
    }
  }
);

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
    // Reducer to manually set the auth state after a successful Firebase login in AuthProvider
    setAuthState: (state, action) => {
        state.isAuthenticated = true;
        state.accessToken = action.payload.token;
        state.profile = action.payload.profile;
        state.status = 'succeeded';
    },
    // Reducer to clear auth state on logout
    clearAuthState: (state) => {
      state.accessToken = null;
      state.profile = null;
      state.isAuthenticated = false;
      state.status = 'idle';
      clearAuthToken();
      delete axiosInstance.defaults.headers.common['Authorization'];
      if(auth.currentUser) signOut(auth);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginSuperuser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loginSuperuser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isAuthenticated = true;
        state.accessToken = action.payload.token;
        state.profile = action.payload.profile;
      })
      .addCase(loginSuperuser.rejected, (state, action) => {
        state.status = 'failed';
        state.isAuthenticated = false;
        state.error = action.payload;
      });
  },
});

export const { setAuthState, clearAuthState } = authSlice.actions;
export default authSlice.reducer;