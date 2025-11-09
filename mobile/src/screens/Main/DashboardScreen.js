import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { colors } from '../../theme/colors';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice';
import { fetchBots } from '../../store/botsSlice';
import { fetchUserPortfolio } from '../../api/apiService'; // Using direct API call for portfolio for now
import Button from '../../components/common/Button';
import PortfolioChart from '../../components/dashboard/PortfolioChart';
import { useQuery } from '@tanstack/react-query'; // Use React Query for portfolio

// Re-add StatCard here for simplicity
const StatCard = ({ title, value }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const DashboardScreen = () => {
  const dispatch = useDispatch();
  const profile = useSelector((state) => state.auth.profile);
  const { bots, status: botsStatus } = useSelector((state) => state.bots);

  // Use React Query for portfolio data, which handles caching and refetching
  const { data: portfolioData, isLoading: portfolioLoading, refetch } = useQuery({
    queryKey: ['portfolio'],
    queryFn: fetchUserPortfolio,
  });

  useEffect(() => {
    dispatch(fetchBots());
  }, [dispatch]);

  const totalPnl = useMemo(() => {
    return bots.reduce((sum, bot) => sum + (bot.is_paper_trading ? bot.paper_pnl_usd : bot.live_pnl_usd), 0).toFixed(2);
  }, [bots]);

  const activeBotsCount = useMemo(() => bots.filter(b => b.is_active).length, [bots]);
  const portfolioValue = useMemo(() => portfolioData?.data?.reduce((sum, asset) => sum + asset.usd_value, 0) || 0, [portfolioData]);

  const onRefresh = React.useCallback(() => {
    refetch();
    dispatch(fetchBots());
  }, [dispatch, refetch]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={botsStatus === 'loading' || portfolioLoading} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Welcome, {profile?.profile?.first_name || profile?.email}!</Text>

      <View style={styles.statsGrid}>
        <StatCard title="Portfolio Value" value={`$${portfolioValue.toFixed(2)}`} />
        <StatCard title="Total P&L" value={`$${totalPnl}`} />
      </View>

      <Text style={styles.sectionTitle}>Portfolio Allocation</Text>
      <PortfolioChart portfolioData={portfolioData?.data} isLoading={portfolioLoading} />

      <Text style={styles.sectionTitle}>Bot Status</Text>
      <View style={styles.statsGrid}>
          <StatCard title="Total Bots" value={bots.length} />
          <StatCard title="Active Bots" value={activeBotsCount} />
      </View>

      <Button title="Logout" onPress={() => dispatch(logout())} style={{ marginTop: 40 }} />
    </ScrollView>
  );
};

// ... (styles from previous step, with minor adjustments)
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: colors.dark.primary },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.dark.text, marginBottom: 20 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: colors.dark.secondary, padding: 15, borderRadius: 10, marginHorizontal: 5 },
  statTitle: { color: colors.dark.muted, fontSize: 14, marginBottom: 5 },
  statValue: { color: colors.dark.text, fontSize: 22, fontWeight: 'bold' },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: colors.dark.text, marginBottom: 15, marginTop: 10 },
});

export default DashboardScreen;