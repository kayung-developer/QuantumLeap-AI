// src/components/strategylab/BacktestResultsDisplay.js (NEW FILE)

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '../dashboard/StatCard'; // Reuse our existing StatCard for consistency
import { FaChartLine, FaArrowDown, FaSortNumericUp, FaTrophy, FaExchangeAlt } from 'react-icons/fa';

// A custom tooltip for the chart for better styling
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 bg-secondary border border-border-color rounded-md shadow-lg">
                <p className="label text-sm text-light-gray">{`${label}`}</p>
                <p className="intro text-success">{`Strategy : ${payload[0].value.toFixed(2)}`}</p>
                <p className="intro text-accent">{`Buy & Hold : ${payload[1].value.toFixed(2)}`}</p>
            </div>
        );
    }
    return null;
};

const BacktestResultsDisplay = ({ results }) => {
    if (!results || !results.portfolio_over_time) {
        return <p className="text-center text-light-gray">No backtest results to display.</p>;
    }

    // Format the portfolio data for the chart
    const chartData = results.portfolio_over_time.map(point => ({
        date: new Date(point.timestamp * 1000).toLocaleDateString(),
        strategy_value: point.value,
        buy_and_hold_value: point.buy_and_hold_value,
    }));

    const winRate = results.total_trades > 0 ? (results.winning_trades / results.total_trades) * 100 : 0;
    const finalPortfolioValue = results.final_portfolio_value;
    const totalReturn = results.total_return_pct;

    return (
        <div className="space-y-6">
            {/* Key Performance Indicators (KPIs) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                    title="Total Return"
                    value={`${totalReturn.toFixed(2)}%`}
                    icon={<FaChartLine />}
                    changeType={totalReturn >= 0 ? 'positive' : 'negative'}
                />
                <StatCard
                    title="Max Drawdown"
                    value={`${results.max_drawdown_pct.toFixed(2)}%`}
                    icon={<FaArrowDown />}
                    changeType='negative' // Drawdown is always a negative concept
                />
                <StatCard
                    title="Sharpe Ratio"
                    value={results.sharpe_ratio.toFixed(2)}
                    icon={<FaSortNumericUp />}
                />
                <StatCard
                    title="Win Rate"
                    value={`${winRate.toFixed(1)}%`}
                    icon={<FaTrophy />}
                />
                <StatCard
                    title="Total Trades"
                    value={results.total_trades}
                    icon={<FaExchangeAlt />}
                />
            </div>

            {/* Equity Curve Chart */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-2">Portfolio Growth</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                        <XAxis dataKey="date" stroke="#8B949E" fontSize={12} />
                        <YAxis stroke="#8B949E" fontSize={12} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line type="monotone" dataKey="strategy_value" name="Strategy" stroke="#58A6FF" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="buy_and_hold_value" name="Buy & Hold" stroke="#E6EDF3" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default BacktestResultsDisplay;