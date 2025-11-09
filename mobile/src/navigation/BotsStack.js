// src/navigation/BotsStack.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BotsScreen from '../screens/Main/BotsScreen';
import BotDetailScreen from '../screens/Main/BotDetailScreen'; // Will be created next
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

const BotsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.dark.secondary },
        headerTintColor: colors.dark.text,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="BotsList" component={BotsScreen} options={{ title: 'My Bots' }} />
      <Stack.Screen name="BotDetail" component={BotDetailScreen} options={({ route }) => ({ title: route.params.botName })} />
    </Stack.Navigator>
  );
};

export default BotsStack;