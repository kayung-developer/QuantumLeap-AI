// src/pages/BotDetailPage.js

import React, { useMemo, useState } from 'react'; // <-- Import useState
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBotDetails, fetchBotLogs, startBot, stopBot } from '../api/apiService';
import useWebSocketListener from '../hooks/useWebSocketListener';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import Card from '../components/common/Card';
import { FaArrowLeft, FaServer, FaCogs, FaHistory, FaCheckCircle, FaChartLine, FaChartBar } from 'react-icons/fa'; // <-- Import FaChartBar
import { AnimatePresence, motion } from 'framer-motion';
import BotDetailHeader from '../components/bots/BotDetailHeader';
import StatCard from '../components/dashboard/StatCard'; // Reusing the StatCard from dashboard
import AnalyticsTab from '../components/bots/AnalyticsTab';

const BotDetailPage = () => {
    const { botId } = useParams();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('configuration');

    // --- Data Fetching ---
    const { data: botDetails, isLoading: detailsLoading, error: detailsError } = useQuery({
        queryKey: ['botDetails', botId],
        queryFn: () => fetchBotDetails(botId),
    });

    const { data: tradeLogs, isLoading: logsLoading, error: logsError } = useQuery({
        queryKey: ['botLogs', botId],
        queryFn: () => fetchBotLogs(botId),
    });

    // --- Mutations ---
    const mutationOptions = {
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['botDetails', botId] });
            queryClient.invalidateQueries({ queryKey: ['bots'] });
        },
    };
    const startMutation = useMutation({ mutationFn: startBot, ...mutationOptions });
    const stopMutation = useMutation({ mutationFn: stopBot, ...mutationOptions });

    // --- WebSocket for Real-time Logs ---
    const filterCondition = React.useMemo(() => (msg) => msg.bot_id === botId, [botId]);
    const liveLogs = useWebSocketListener(filterCondition);

    const bot = botDetails?.data;

    // --- Derived Stats from Logs ---
    const performanceStats = useMemo(() => {
        if (!tradeLogs?.data || tradeLogs.data.length === 0) {
            return { pnl: 0, winRate: 0, totalTrades: 0 };
        }
        let pnl = 0;
        let wins = 0;
        const trades = tradeLogs.data;
        // Simplified PNL calculation: assumes sequential buy/sell pairs
        for (let i = 0; i < trades.length - 1; i += 2) {
            if (trades[i+1] && trades[i].side === 'buy' && trades[i+1].side === 'sell') {
                const profit = trades[i+1].cost - trades[i].cost;
                pnl += profit;
                if (profit > 0) wins++;
            }
        }
        const totalPairedTrades = Math.floor(trades.length / 2);
        const winRate = totalPairedTrades > 0 ? (wins / totalPairedTrades) * 100 : 0;
        return { pnl: pnl.toFixed(2), winRate: winRate.toFixed(1), totalTrades: trades.length };
    }, [tradeLogs]);

    if (detailsLoading) return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
    if (detailsError) return <Alert type="error" message={`Failed to load bot details: ${detailsError.message}`} />;

     const getLogColor = (type) => {
        switch (type) {
            case 'error': return 'text-danger';
            case 'trade_executed': return 'text-success';
            case 'bot_status': return 'text-accent';
            default: return 'text-light-gray'; // For 'bot_log'
        }
    };

    return (
        <div>
            <Link to="/dashboard/bots" className="inline-flex items-center text-accent mb-6 hover:text-accent-dark transition-colors">
                <FaArrowLeft className="mr-2" />
                Back to My Bots
            </Link>

            <BotDetailHeader
                bot={bot}
                onStart={startMutation.mutate}
                onStop={stopMutation.mutate}
            />

            {/* --- NEW: Tabbing Interface --- */}
            <div className="border-b border-border-color mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('configuration')} className={`${activeTab === 'configuration' ? 'border-accent text-accent' : 'border-transparent text-light-gray hover:text-white hover:border-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}><FaCogs className="mr-2"/> Configuration</button>
                    <button onClick={() => setActiveTab('analytics')} className={`${activeTab === 'analytics' ? 'border-accent text-accent' : 'border-transparent text-light-gray hover:text-white hover:border-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}><FaChartBar className="mr-2"/> Analytics</button>
                </nav>
            </div>

            {/* --- StatCard Grid --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <StatCard
                    title="Total PNL (USD)"
                    value={`$${performanceStats.pnl}`}
                    valueColor={performanceStats.pnl >= 0 ? 'text-success' : 'text-danger'}
                    icon={<FaChartLine className="text-accent text-2xl"/>}
                />
                <StatCard
                    title="Win Rate"
                    value={`${performanceStats.winRate}%`}
                    icon={<FaCheckCircle className="text-accent text-2xl"/>}
                />
                 <StatCard
                    title="Total Trades"
                    value={performanceStats.totalTrades}
                    icon={<FaHistory className="text-accent text-2xl"/>}
                />
            </div>

            {/* --- Main Content Grid --- */}
            {activeTab === 'configuration' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center"><FaCogs className="mr-3 text-accent"/>Configuration</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                            <p><strong>Strategy:</strong> <span className="font-mono text-white">{bot?.strategy_name}</span></p>
                            <p><strong>Mode:</strong> <span className="font-mono text-white">{bot?.is_paper_trading ? 'Paper Trading' : 'Live Trading'}</span></p>
                             <p><strong>Dynamic Sizing:</strong> <span className="font-mono text-white">{bot?.use_dynamic_sizing ? 'Enabled' : 'Disabled'}</span></p>
                            <p><strong>Market Filter:</strong> <span className="font-mono text-white">{bot?.market_regime_filter_enabled ? 'Enabled' : 'Disabled'}</span></p>
                            <p><strong>Take Profit:</strong> <span className="font-mono text-success">{bot?.take_profit_percentage ? `${bot.take_profit_percentage}%` : 'Not Set'}</span></p>
                            <p><strong>Stop Loss:</strong> <span className="font-mono text-danger">{bot?.stop_loss_percentage ? `${bot.stop_loss_percentage}%` : 'Not Set'}</span></p>
                            <div className="col-span-1 md:col-span-2">
                                <strong>Parameters:</strong>
                                <pre className="text-xs bg-primary p-3 rounded-md mt-1 overflow-x-auto font-mono">
                                    {JSON.stringify(bot?.strategy_params, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center"><FaHistory className="mr-3 text-accent" />Trade History</h2>
                        {logsLoading ? <div className="flex justify-center p-8"><Spinner /></div> : logsError ? <Alert type="error" message={logsError.message} /> : (
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
                                        {tradeLogs?.data.map(log => (
                                            <tr key={log.id} className="hover:bg-secondary">
                                                <td className="px-4 py-3 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className={`px-4 py-3 font-semibold ${log.side === 'buy' ? 'text-success' : 'text-danger'}`}>{log.side.toUpperCase()}</td>
                                                <td className="px-4 py-3 text-right font-mono">{log.amount.toFixed(6)}</td>
                                                <td className="px-4 py-3 text-right font-mono">${log.price.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-mono">${log.cost.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {tradeLogs?.data.length === 0 && <p className="text-center p-8 text-light-gray">No trades have been executed by this bot yet.</p>}
                            </div>
                        )}
                    </Card>
                </div>

                <Card className="lg:col-span-1">
                    <h2 className="text-xl font-semibold text-white mb-4">Live Operational Logs</h2>
                    <div className="h-96 bg-primary p-3 rounded-md overflow-y-auto flex flex-col-reverse">
                        {/* `AnimatePresence` makes new logs slide in smoothly */}
                        <AnimatePresence>
                            {liveLogs.map((log, index) => (
                                <motion.div
                                    key={`${log.timestamp}-${index}`} // A more unique key
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className={`text-xs p-1 font-mono border-b border-border-color/50 ${getLogColor(log.type)}`}
                                >
                                   <span className="text-gray-500 mr-2">{new Date().toLocaleTimeString()}:</span>
                                   {log.message || `Event: ${log.type.replace(/_/g, ' ')}`}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {liveLogs.length === 0 && <p className="text-center text-sm text-gray-500 m-auto">Waiting for bot activity...</p>}
                    </div>
                </Card>
            </div>
          )}
          {activeTab === 'analytics' && bot && (
                <AnalyticsTab bot={bot} />
            )}
        </div>
    );
};

export default BotDetailPage;
