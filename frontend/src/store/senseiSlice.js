// src/store/senseiSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { interpretStrategy } from '../api/apiService';
import { getErrorMessage } from '../api/axiosInstance';

// Async thunk to handle the conversation with the backend
export const sendMessageToSensei = createAsyncThunk(
  'sensei/sendMessage',
  async ({ text, history }, { rejectWithValue }) => {
    try {
      const response = await interpretStrategy(text, history);
      return response.data.response; // The AI's text response
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

const senseiSlice = createSlice({
  name: 'sensei',
  initialState: {
    messages: [
      { role: 'assistant', content: "Hello! I am the Strategy Sensei. Describe your trading idea, and I'll help you build it." }
    ],
    status: 'idle', // 'idle' | 'loading' | 'failed'
  },
  reducers: {
    // A reducer to add the user's message to the state immediately
    addUserMessage: (state, action) => {
      state.messages.push({ role: 'user', content: action.payload });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessageToSensei.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(sendMessageToSensei.fulfilled, (state, action) => {
        state.status = 'idle';
        state.messages.push({ role: 'assistant', content: action.payload });
      })
      .addCase(sendMessageToSensei.rejected, (state, action) => {
        state.status = 'failed';
        state.messages.push({ role: 'assistant', content: `I'm sorry, I've encountered an error: ${action.payload}` });
      });
  },
});

export const { addUserMessage } = senseiSlice.actions;
export default senseiSlice.reducer;