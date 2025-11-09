// src/components/common/Button.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';

const Button = ({ title, onPress, disabled = false, isLoading = false, style }) => {
  return (
    <TouchableOpacity
      style={[styles.button, disabled || isLoading ? styles.buttonDisabled : {}, style]}
      onPress={onPress}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.dark.primary} />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: colors.accent,
    opacity: 0.5,
  },
  buttonText: {
    color: colors.dark.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Button;