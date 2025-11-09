// src/navigation/AppNavigator.js
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import AuthStack from './AuthStack';
import MainTabNavigator from './MainTabNavigator';
import { checkAuthSession } from '../store/authSlice';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';

const AppNavigator = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, status } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(checkAuthSession());
  }, [dispatch]);

  // Show a loading screen while checking the session
  if (status === 'idle' || (status === 'loading' && !isAuthenticated)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return isAuthenticated ? <MainTabNavigator /> : <AuthStack />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.primary,
  },
});

export default AppNavigator;