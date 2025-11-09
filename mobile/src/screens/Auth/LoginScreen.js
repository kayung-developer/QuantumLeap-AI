// src/screens/Auth/LoginScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../../store/authSlice';
import { colors } from '../../theme/colors';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }
    dispatch(loginUser({ email, password }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.innerContainer}>
            <Text style={styles.title}>QuantumLeap AI</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            <Input
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
            />
            <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            {error && status === 'failed' && <Text style={styles.errorText}>{error}</Text>}

            <View style={{ height: 20 }} />

            <Button
                title={status === 'loading' ? 'Signing In...' : 'Sign In'}
                onPress={handleLogin}
                isLoading={status === 'loading'}
            />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.dark.primary },
    container: { flex: 1, justifyContent: 'center' },
    innerContainer: { paddingHorizontal: 20 },
    title: { fontSize: 32, color: colors.dark.text, textAlign: 'center', marginBottom: 10, fontWeight: 'bold' },
    subtitle: { fontSize: 16, color: colors.dark.muted, textAlign: 'center', marginBottom: 40 },
    errorText: { color: colors.danger, textAlign: 'center', marginBottom: 10, marginTop: 5 },
});

export default LoginScreen;