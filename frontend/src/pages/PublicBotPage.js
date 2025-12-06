// src/pages/PublicBotPage.js

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPublicBotPerformance } from '../api/apiService'; 
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { FaHistory, FaArrowRight } from 'react-icons/fa';

const Stat = ({ label, value, valueColor = 'text-white' }) => (
    <div className="bg-primary p-4 rounded-lg text-center">
        <p className="text-sm text-light-gray">{label}</p>
        <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
);

const PublicBotPage = () => {
    const { botId } = useParams();

    const { data: response, isLoading, error } = useQuery({
        queryKey: ['publicBot', botId],
        queryFn: () => getPublicBotPerformance(botId),
        staleTime: 60000, 
    });

    if (isLoading) return <div className="min-h-screen bg-primary flex justify-center items-center"><Spinner size="lg" /></div>;
    if (error) return (
        <div className="min-h-screen bg-primary flex justify-center items-center p-4">
            <Alert type="error" message={`Could not load bot data: ${error.response?.data?.detail || error.message}`} />
        </div>
    );

    const bot = response?.data;
    const perf = bot?.backtest_results_cache;

    // Helper for safe formatting
    const fmt = (val, d=2) => (parseFloat(val) || 0).toFixed(d);

    return (
        <div className="min-h-screen bg-primary text-white">
            <header className="bg-secondary border-b border-border-color">
                <div className="container mx-auto px-4 flex items-center justify-between h-20">
                    <Link to="/" className="flex items-center space-x-2">
                        <img src="/app.png" alt="QuantumLeap Logo" className="h-8 w-8" />
                        <span className="text-white text-xl font-bold">QuantumLeap AI</span>
                    </Link>
                    <Link to="/register">
                        <Button>Create Your Own Bot <FaArrowRight className="ml-2"/></Button>
                    </Link>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8">
                <Card className="mb-6">
                    <h1 className="text-3xl font-bold text-white">{bot.name}</h1>
                    <p className="text-accent font-semibold">{bot.strategy_name.replace(/_/g, ' ')} on {bot.symbol}</p>
                    <p className="text-sm text-light-gray mt-2">{bot.description}</p>
                </Card>

                {perf && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                        <Stat 
                            label="Backtest Return" 
                            value={`${fmt(perf.total_return_pct, 1)}%`} 
                            valueColor={(perf.total_return_pct || 0) > 0 ? 'text-success' : 'text-danger'} 
                        />
                        <Stat label="Sharpe Ratio" value={fmt(perf.sharpe_ratio, 2)} />
                        <Stat 
                            label="Max Drawdown" 
                            value={`${fmt(perf.max_drawdown_pct, 1)}%`} 
                            valueColor="text-warning" 
                        />
                        <Stat label="Total Trades" value={perf.total_trades || 0} />
                    </div>
                )}

                <Card>
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center"><FaHistory className="mr-3 text-accent" />Live Trade History</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-light-gray">
                            <thead className="text-xs text-gray-400 uppercase bg-primary/50">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Side</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-right">Price</th>
                                    <th className="px-4 py-3 text-right">Total (USD)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-color">
                                {bot.trade_logs.map(log => (
                                    <tr key={log.id} className="hover:bg-secondary">
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className={`px-4 py-3 font-semibold ${log.side === 'buy' ? 'text-success' : 'text-danger'}`}>{log.side.toUpperCase()}</td>
                                        <td className="px-4 py-3 text-right font-mono">{parseFloat(log.amount).toFixed(6)}</td>
                                        <td className="px-4 py-3 text-right font-mono">${parseFloat(log.price).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-mono">${parseFloat(log.cost).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {bot.trade_logs.length === 0 && <p className="text-center p-8 text-light-gray">No live trades have been executed by this bot yet.</p>}
                    </div>
                </Card>
            </main>
        </div>
    );
};

export default PublicBotPage;