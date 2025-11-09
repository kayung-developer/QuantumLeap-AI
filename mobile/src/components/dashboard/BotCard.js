// src/components/dashboard/BotCard.js
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import Button from '../common/Button'; // Assuming you have this
import { useDispatch, useSelector } from 'react-redux';
import { startBotAsync, stopBotAsync } from '../../store/botsSlice';

const BotCard = ({ bot }) => {
  const dispatch = useDispatch();
  const { mutationStatus, mutatingBotId } = useSelector((state) => state.bots);
  const isMutatingThisCard = mutationStatus === 'loading' && mutatingBotId === bot.id;

  const handleStart = () => dispatch(startBotAsync(bot.id));
  const handleStop = () => dispatch(stopBotAsync(bot.id));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.botName}>{bot.name}</Text>
        <View style={[styles.statusBadge, bot.is_active ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={[styles.statusText, bot.is_active ? styles.activeText : styles.inactiveText]}>
            {bot.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <Text style={styles.botInfo}>{bot.symbol} on {bot.exchange}</Text>
      <Text style={styles.botInfo}>Strategy: {bot.strategy_name.replace(/_/g, ' ')}</Text>
      <View style={styles.actions}>
        {bot.is_active ? (
          <Button title="Stop" onPress={handleStop} isLoading={isMutatingThisCard} style={styles.stopButton} />
        ) : (
          <Button title="Start" onPress={handleStart} isLoading={isMutatingThisCard} style={styles.startButton} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: colors.dark.secondary, padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: colors.dark.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  botName: { fontSize: 18, fontWeight: 'bold', color: colors.dark.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeBadge: { backgroundColor: 'rgba(52, 211, 153, 0.1)' },
  inactiveBadge: { backgroundColor: 'rgba(248, 113, 113, 0.1)' },
  statusText: { fontSize: 12, fontWeight: '600' },
  activeText: { color: colors.success },
  inactiveText: { color: colors.danger },
  botInfo: { color: colors.dark.muted, fontSize: 14, marginBottom: 3 },
  actions: { marginTop: 15, borderTopWidth: 1, borderTopColor: colors.dark.border, paddingTop: 15 },
  startButton: { backgroundColor: colors.success },
  stopButton: { backgroundColor: colors.danger },
});

export default BotCard;