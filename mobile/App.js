// App.js
import React from 'react';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme/colors';

// Create a client for React Query
const queryClient = new QueryClient();

export default function App() {
  return (
    // 1. Redux Provider for global state (auth session, UI state)
    <Provider store={store}>
      {/* 2. React Query Provider for server state (fetching, caching) */}
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={{
          dark: true,
          colors: {
            primary: colors.dark.text,
            background: colors.dark.primary,
            card: colors.dark.secondary,
            text: colors.dark.text,
            border: colors.dark.border,
            notification: colors.accent,
          },
        }}>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </Provider>
  );
}