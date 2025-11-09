// src/screens/Main/SettingsScreen.js
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { colors } from '../../theme/colors';
import { logout } from '../../store/authSlice';
import { Ionicons } from '@expo/vector-icons';

const SettingsRow = ({ icon, label, value, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.row} disabled={!onPress}>
    <Ionicons name={icon} size={22} color={colors.dark.muted} style={styles.icon}/>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
    {onPress && <Ionicons name="chevron-forward" size={20} color={colors.dark.muted} />}
  </TouchableOpacity>
);

const SettingsScreen = () => {
  const profile = useSelector((state) => state.auth.profile);
  const dispatch = useDispatch();

  return (
    <SafeAreaView style={styles.container}>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.card}>
            <SettingsRow icon="person-circle-outline" label="Email" value={profile?.email} />
            <SettingsRow icon="star-outline" label="Plan" value={profile?.subscription_plan?.toUpperCase()} />
            <SettingsRow icon="shield-checkmark-outline" label="Security" value="" onPress={() => {}}/>
            <SettingsRow icon="notifications-outline" label="Notifications" value="" onPress={() => {}}/>
        </View>
        <TouchableOpacity onPress={() => dispatch(logout())} style={[styles.row, styles.logoutButton]}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} style={styles.icon}/>
          <Text style={styles.logoutLabel}>Logout</Text>
        </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.primary },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.dark.text, padding: 15 },
  card: { backgroundColor: colors.dark.secondary, borderRadius: 10, margin: 15, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.dark.border },
  icon: { marginRight: 15 },
  label: { color: colors.dark.text, fontSize: 16, flex: 1 },
  value: { color: colors.dark.muted, fontSize: 16 },
  logoutButton: { backgroundColor: colors.dark.secondary, borderRadius: 10, marginHorizontal: 15, marginTop: 20 },
  logoutLabel: { color: colors.danger, fontSize: 16, flex: 1 },
});

export default SettingsScreen;