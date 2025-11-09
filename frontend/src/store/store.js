// src/store/store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import botsReducer from './botsSlice';
import walletReducer from './walletSlice';
import senseiReducer from './senseiSlice'; // 1. Import

export const store = configureStore({
  reducer: {
    auth: authReducer,
    bots: botsReducer,
    wallet: walletReducer,
    sensei: senseiReducer, // 2. Add
  },
});