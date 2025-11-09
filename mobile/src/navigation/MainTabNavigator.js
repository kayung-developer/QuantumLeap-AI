// src/navigation/MainTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/Main/DashboardScreen';
import BotsStack from './BotsStack';
import WalletScreen from '../screens/Main/WalletScreen';
import SettingsScreen from '../screens/Main/SettingsScreen'; // 1. Import
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.dark.secondary, borderTopColor: colors.dark.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.dark.muted,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'speedometer' : 'speedometer-outline';
          else if (route.name === 'Bots') iconName = focused ? 'server' : 'server-outline';
          else if (route.name === 'Wallet') iconName = focused ? 'wallet' : 'wallet-outline';
          else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline'; // 2. Add icon
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{headerShown: true}} />
      <Tab.Screen name="Bots" component={BotsStack} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{headerShown: true}} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{headerShown: false}} /> {/* 3. Add tab */}
    </Tab.Navigator>
  );
};

export default MainTabNavigator;