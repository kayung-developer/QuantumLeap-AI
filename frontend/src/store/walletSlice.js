// src/store/walletSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWalletBalances, fetchTransactions } from '../api/apiService';
import { getErrorMessage } from '../api/axiosInstance';

export const fetchWalletData = createAsyncThunk('wallet/fetchWalletData', async (_, { rejectWithValue }) => {
  try {
    // Fetch balances and transactions in parallel for speed
    const [balancesResponse, transactionsResponse] = await Promise.all([
      fetchWalletBalances(),
      fetchTransactions()
    ]);
    return { balances: balancesResponse.data, transactions: transactionsResponse.data };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const walletSlice = createSlice({
  name: 'wallet',
  initialState: {
    balances: [],
    transactions: [],
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWalletData.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchWalletData.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.balances = action.payload.balances;
        state.transactions = action.payload.transactions;
      })
      .addCase(fetchWalletData.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export default walletSlice.reducer;