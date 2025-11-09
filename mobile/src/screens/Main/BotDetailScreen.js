// src/screens/Main/BotDetailScreen.js
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBotDetailsAsync, clearSelectedBot } from '../../store/botsSlice';
import { colors } from '../../theme/colors';

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const BotDetailScreen = ({ route }) => {
  const { botId } = route.params;
  const dispatch = useDispatch();
  const { selectedBot, tradeLogs, detailStatus, error } = useSelector((state) => state.bots);

  useEffect(() => {
    dispatch(fetchBotDetailsAsync(botId));
    // Cleanup when the screen is unmounted
    return () => {
      dispatch(clearSelectedBot());
    };
  }, [dispatch, botId]);

  if (detailStatus === 'loading' || !selectedBot) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  if (detailStatus === 'failed') {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Configuration</Text>
        <DetailRow label="Strategy" value={selectedBot.strategy_name.replace(/_/g, ' ')} />
        <DetailRow label="Market" value={`${selectedBot.symbol} on ${selectedBot.exchange}`} />
        <DetailRow label="Mode" value={selectedBot.is_paper_trading ? 'Paper Trading' : 'Live'} />
        <DetailRow label="Market Type" value={selectedBot.market_type} />
        {selectedBot.market_type === 'future' && <DetailRow label="Leverage" value={`${selectedBot.leverage}x`} />}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trade History</Text>
        {tradeLogs.length > 0 ? (
          tradeLogs.map(log => (
            <View key={log.id} style={styles.logRow}>
              <View>
                <Text style={styles.logSide(log.side)}>{log.side.toUpperCase()}</Text>
                <Text style={styles.logDate}>{new Date(log.timestamp).toLocaleString()}</Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.logAmount}>{log.amount.toFixed(6)}</Text>
                <Text style={styles.logPrice}>@ ${log.price.toFixed(2)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No trades have been executed yet.</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark.primary },
  container: { flex: 1, backgroundColor: colors.dark.primary, padding: 15 },
  card: { backgroundColor: colors.dark.secondary, padding: 15, borderRadius: 10, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.dark.text, marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.dark.border },
  detailLabel: { color: colors.dark.muted, fontSize: 14 },
  detailValue: { color: colors.dark.text, fontSize: 14, fontWeight: '600' },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.dark.border },
  logSide: side => ({ color: side === 'buy' ? colors.success : colors.danger, fontWeight: 'bold' }),
  logDate: { color: colors.dark.muted, fontSize: 12, marginTop: 4 },
  logAmount: { color: colors.dark.text, fontWeight: 'bold' },
  logPrice: { color: colors.dark.muted, fontSize: 12, marginTop: 4 },
  emptyText: { color: colors.dark.muted, textAlign: 'center', padding: 20 },
  errorText: { color: colors.danger },
});

export default BotDetailScreen;