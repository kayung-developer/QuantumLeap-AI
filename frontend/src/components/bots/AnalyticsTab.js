import React from 'react';
import Card from '../common/Card';
import EquityCurveChart from '../analytics/EquityCurveChart';
import DrawdownChart from '../analytics/DrawdownChart';

const MetricCard = ({ title, value, tooltip }) => (
    <div className="bg-primary p-4 rounded-lg text-center" title={tooltip}>
        <p className="text-sm text-light-gray">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
    </div>
);

const AnalyticsTab = ({ bot }) => {
    const analytics = bot.is_paper_trading ? bot.performance_analytics_cache?.paper : bot.performance_analytics_cache?.live;

    if (!analytics || analytics.error) {
        return <p className="text-center text-light-gray p-8">{analytics?.error || "No analytics data available. Complete a trade to generate stats."}</p>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <MetricCard title="Sharpe Ratio" value={analytics.sharpe_ratio.toFixed(2)} tooltip="Measures risk-adjusted return." />
                <MetricCard title="Sortino Ratio" value={analytics.sortino_ratio.toFixed(2)} tooltip="Measures risk-adjusted return, focusing only on downside volatility." />
                <MetricCard title="Calmar Ratio" value={analytics.calmar_ratio.toFixed(2)} tooltip="Return relative to max drawdown." />
                <MetricCard title="Max Drawdown" value={`${(analytics.max_drawdown * 100).toFixed(2)}%`} tooltip="Largest peak-to-trough decline." />
            </div>

            <Card>
                <h3 className="text-xl font-semibold mb-4">Equity Curve</h3>
                <EquityCurveChart data={analytics.equity_curve} />
            </Card>
             <Card>
                <h3 className="text-xl font-semibold mb-4">Drawdown Curve</h3>
                <DrawdownChart data={analytics.drawdown_curve} />
            </Card>
        </div>
    );
};
export default AnalyticsTab;