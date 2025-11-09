// src/components/common/Input.js
import React from 'react';
import { TextInput, StyleSheet, View, Text } from 'react-native';
import { colors } from '../../theme/colors';

const Input = ({ label, style, ...props }) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.dark.muted}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 15,
  },
  label: {
    color: colors.dark.muted,
    marginBottom: 5,
    fontSize: 14,
  },
  input: {
    backgroundColor: colors.dark.secondary,
    color: colors.dark.text,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.dark.border,
    fontSize: 16,
  },
});

export default Input;