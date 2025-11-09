// src/store/botsSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchUserBots,
  startBot,
  stopBot,
  createBot,
  fetchBotDetails,
  fetchBotLogs
} from '../api/apiService';
import { getErrorMessage } from '../api/axiosInstance';

// --- ASYNC THUNKS ---

export const fetchBots = createAsyncThunk('bots/fetchBots', async (_, { rejectWithValue }) => {
  try {
    const response = await fetchUserBots();
    return response.data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const createBotAsync = createAsyncThunk('bots/createBot', async (botData, { rejectWithValue }) => {
    try {
        const response = await createBot(botData);
        return response.data;
    } catch (error) {
        return rejectWithValue(getErrorMessage(error));
    }
});

export const startBotAsync = createAsyncThunk('bots/startBot', async (botId, { rejectWithValue }) => {
  try {
    await startBot(botId);
    return botId;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const stopBotAsync = createAsyncThunk('bots/stopBot', async (botId, { rejectWithValue }) => {
  try {
    await stopBot(botId);
    return botId;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const fetchBotDetailsAsync = createAsyncThunk('bots/fetchBotDetails', async (botId, { rejectWithValue }) => {
  try {
    const detailsPromise = fetchBotDetails(botId);
    const logsPromise = fetchBotLogs(botId);
    const [detailsResponse, logsResponse] = await Promise.all([detailsPromise, logsPromise]);
    return { details: detailsResponse.data, logs: logsResponse.data };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});


// --- THE SLICE ---

const botsSlice = createSlice({
  name: 'bots',
  initialState: {
    bots: [],
    selectedBot: null,
    tradeLogs: [],
    status: 'idle', // For the main list
    detailStatus: 'idle', // For the detail view
    mutationStatus: 'idle', // For create/start/stop actions
    mutatingBotId: null,
    error: null,
  },
  reducers: {
    clearSelectedBot: (state) => {
      state.selectedBot = null;
      state.tradeLogs = [];
      state.detailStatus = 'idle';
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetching all bots
      .addCase(fetchBots.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchBots.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.bots = action.payload;
      })
      .addCase(fetchBots.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Creating a bot
      .addCase(createBotAsync.pending, (state) => { state.mutationStatus = 'loading'; })
      .addCase(createBotAsync.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.bots.push(action.payload);
      })
      .addCase(createBotAsync.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.error = action.payload;
      })
      // Starting a bot
      .addCase(startBotAsync.pending, (state, action) => {
        state.mutationStatus = 'loading';
        state.mutatingBotId = action.meta.arg;
      })
      .addCase(startBotAsync.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.mutatingBotId = null;
        const bot = state.bots.find((b) => b.id === action.payload);
        if (bot) bot.is_active = true;
      })
      .addCase(startBotAsync.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutatingBotId = null;
        state.error = action.payload;
      })
      // Stopping a bot
      .addCase(stopBotAsync.pending, (state, action) => {
        state.mutationStatus = 'loading';
        state.mutatingBotId = action.meta.arg;
      })
      .addCase(stopBotAsync.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.mutatingBotId = null;
        const bot = state.bots.find((b) => b.id === action.payload);
        if (bot) bot.is_active = false;
      })
      .addCase(stopBotAsync.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutatingBotId = null;
        state.error = action.payload;
      })
      // Fetching bot details
      .addCase(fetchBotDetailsAsync.pending, (state) => { state.detailStatus = 'loading'; })
      .addCase(fetchBotDetailsAsync.fulfilled, (state, action) => {
        state.detailStatus = 'succeeded';
        state.selectedBot = action.payload.details;
        state.tradeLogs = action.payload.logs;
      })
      .addCase(fetchBotDetailsAsync.rejected, (state, action) => {
        state.detailStatus = 'failed';
        state.error = action.payload;
      });
  },
});

export const { clearSelectedBot } = botsSlice.actions;
export default botsSlice.reducer;