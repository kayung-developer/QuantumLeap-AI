// src/store/botsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchUserBots, startBot, stopBot } from '../api/apiService';
import { fetchUserBots, startBot, stopBot, fetchBotDetails, fetchBotLogs, createBot } from '../api/apiService';

export const createBotAsync = createAsyncThunk(
  'bots/createBot',
  async (botData, { rejectWithValue }) => {
    try {
      const response = await createBot(botData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create bot.');
    }
  }
);

export const fetchBotDetailsAsync = createAsyncThunk('bots/fetchBotDetails', async (botId, { rejectWithValue }) => {
  try {
    const detailsPromise = fetchBotDetails(botId);
    const logsPromise = fetchBotLogs(botId);
    const [detailsResponse, logsResponse] = await Promise.all([detailsPromise, logsPromise]);
    return { details: detailsResponse.data, logs: logsResponse.data };
  } catch (error) {
    return rejectWithValue(error.response?.data?.detail || 'Failed to fetch bot details.');
  }
});


// Thunk to fetch all user bots
export const fetchBots = createAsyncThunk('bots/fetchBots', async (_, { rejectWithValue }) => {
  try {
    const response = await fetchUserBots();
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.detail || 'Failed to fetch bots.');
  }
});

// Thunk to start a bot
export const startBotAsync = createAsyncThunk('bots/startBot', async (botId, { rejectWithValue }) => {
  try {
    await startBot(botId);
    return botId; // Return the ID on success for the reducer
  } catch (error) {
    return rejectWithValue(error.response?.data?.detail || 'Failed to start bot.');
  }
});

// Thunk to stop a bot
export const stopBotAsync = createAsyncThunk('bots/stopBot', async (botId, { rejectWithValue }) => {
  try {
    await stopBot(botId);
    return botId; // Return the ID on success for the reducer
  } catch (error) {
    return rejectWithValue(error.response?.data?.detail || 'Failed to stop bot.');
  }
});

const botsSlice = createSlice({
  name: 'bots',
  initialState: {
    bots: [],
    selectedBot: null, // NEW: For the detail screen
    tradeLogs: [], // NEW: Logs for the selected bot
    status: 'idle',
    detailStatus: 'idle', // NEW: Separate status for detail loading
    error: null,
    mutationStatus: 'idle',
    mutatingBotId: null,
  },
  reducers: {
    // NEW: Reducer to clear selected bot data when leaving the screen
    clearSelectedBot: (state) => {
      state.selectedBot = null;
      state.tradeLogs = [];
      state.detailStatus = 'idle';
    }
  },
  extraReducers: (builder) => {
    builder
        // Creating a bot
      .addCase(createBotAsync.pending, (state, action) => {
        state.mutationStatus = 'loading';
      })
      .addCase(createBotAsync.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.bots.push(action.payload); // Add the new bot to the list
      })
      .addCase(createBotAsync.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.error = action.payload;
      })

      // Fetching bots
      .addCase(fetchBots.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchBots.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.bots = action.payload;
      })
      .addCase(fetchBots.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Starting a bot
      .addCase(startBotAsync.pending, (state, action) => {
        state.mutationStatus = 'loading';
        state.mutatingBotId = action.meta.arg; // The botId passed to the thunk
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
        state.error = action.payload; // You can display this as a toast
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
      // NEW: Cases for fetching bot details
      .addCase(fetchBotDetailsAsync.pending, (state) => {
        state.detailStatus = 'loading';
      })
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
export const { clearSelectedBot } = botsSlice.actions; // Export the new action
export default botsSlice.reducer;