// src/store/walletSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWalletBalances, fetchTransactions } from '../api/apiService';

export const fetchBalances = createAsyncThunk('wallet/fetchBalances', async (_, { rejectWithValue }) => {
  try {
    const response = await fetchWalletBalances();
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.detail || 'Failed to fetch balances.');
  }
});

export const fetchUserTransactions = createAsyncThunk('wallet/fetchTransactions', async (_, { rejectWithValue }) => {
  try {
    const response = await fetchTransactions();
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.detail || 'Failed to fetch transactions.');
  }
});
export const fetchWalletData = createAsyncThunk('wallet/fetchWalletData', async (_, { rejectWithValue }) => {
  try {
    const balancesPromise = fetchWalletBalances();
    const transactionsPromise = fetchTransactions();
    const [balancesResponse, transactionsResponse] = await Promise.all([balancesPromise, transactionsPromise]);
    return { balances: balancesResponse.data, transactions: transactionsResponse.data };
  } catch (error) {
    return rejectWithValue(error.response?.data?.detail || 'Failed to fetch wallet data.');
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
      .addCase(fetchBalances.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchBalances.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.balances = action.payload;
      })
      .addCase(fetchBalances.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchUserTransactions.fulfilled, (state, action) => {
        state.transactions = action.payload;
      })
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