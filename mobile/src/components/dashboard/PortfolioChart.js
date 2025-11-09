import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { PieChart } from 'react-native-svg-charts';
import { colors } from '../../theme/colors';

const PortfolioChart = ({ portfolioData, isLoading }) => {
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!portfolioData || portfolioData.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>No portfolio data to display.</Text>
      </View>
    );
  }

  const chartData = portfolioData.map((asset, index) => ({
    value: asset.usd_value,
    svg: { fill: ['#2DD4BF', '#3B82F6', '#FBBF24', '#A855F7', '#F87171'][index % 5] },
    key: `pie-${index}`,
    name: asset.asset,
  }));

  return (
    <View style={styles.container}>
      <PieChart style={{ height: 150 }} data={chartData} innerRadius="70%" padAngle={0.02} />
      <View style={styles.legendContainer}>
        {chartData.map(item => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: item.svg.fill }]} />
            <Text style={styles.legendText}>{item.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 15, backgroundColor: colors.dark.secondary, borderRadius: 10 },
  centered: { justifyContent: 'center', alignItems: 'center', height: 200 },
  emptyText: { color: colors.dark.muted, fontSize: 14 },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15, marginBottom: 5 },
  legendColor: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
  legendText: { color: colors.dark.text, fontSize: 12 },
});

export default PortfolioChart;