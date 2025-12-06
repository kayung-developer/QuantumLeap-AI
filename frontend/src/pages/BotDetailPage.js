// src/pages/BotDetailPage.js

import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../hooks/useApiMutation'; 
import { fetchBotDetails, fetchBotLogs, startBot, stopBot, updateBot } from '../api/apiService'; // Ensure updateBot is imported
import useWebSocketListener from '../hooks/useWebSocketListener';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import Card from '../components/common/Card';
import Button from '../components/common/Button'; // Import Button
import Modal from '../components/common/Modal'; // Import Modal
import CreateBotForm from '../components/bots/CreateBotForm'; // Reuse form
import { FaArrowLeft, FaCogs, FaHistory, FaCheckCircle, FaChartLine, FaChartBar, FaEdit } from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';
import BotDetailHeader from '../components/bots/BotDetailHeader';
import StatCard from '../components/dashboard/StatCard';
import AnalyticsTab from '../components/bots/AnalyticsTab';
import toast from 'react-hot-toast'; // Import toast

const BotDetailPage = () => {
    const { botId } = useParams();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('configuration');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State for edit modal

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

    // --- Update Bot Mutation ---
    const updateMutation = useApiMutation(
        ({ botId, botData }) => updateBot({ botId, botData }), 
        {
            onSuccess: () => {
                toast.success("Bot updated successfully!");
                setIsEditModalOpen(false);
                queryClient.invalidateQueries({ queryKey: ['botDetails', botId] });
            },
            onError: (err) => {
                // Robust error handling to extract the message
                const msg = err.response?.data?.detail || err.message || "Network Error";
                toast.error(`Update failed: ${msg}`);
            }
        }
    );

    // --- WebSocket for Real-time Logs ---
    const filterCondition = React.useMemo(() => (msg) => msg.bot_id === botId, [botId]);
    const liveLogs = useWebSocketListener(filterCondition);

    const bot = botDetails?.data;

    const handleUpdate = (formData) => {
        updateMutation.mutate({ botId: bot.id, botData: formData });
    };

    // --- Derived Stats from Logs ---
    const performanceStats = useMemo(() => {
        if (!tradeLogs?.data || tradeLogs.data.length === 0) {
            return { pnl: 0, winRate: 0, totalTrades: 0 };
        }
        let pnl = 0;
        let wins = 0;
        const trades = tradeLogs.data;
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
            case 'error': return 'text-red-600 dark:text-red-400 font-bold';
            case 'trade_executed': return 'text-green-700 dark:text-green-400 font-bold';
            case 'bot_status': return 'text-blue-600 dark:text-accent font-semibold';
            default: return 'text-gray-700 dark:text-gray-300'; // Standard logs: Dark Gray vs Light Gray
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

            {/* --- Tabbing Interface --- */}
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
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-border-color">
                            {/* Header: Black in Light, White in Dark */}
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                <FaCogs className="mr-3 text-accent"/>Configuration
                            </h2>
                            {/* Edit Button */}
                            <Button size="sm" variant="secondary" onClick={() => setIsEditModalOpen(true)} disabled={bot.is_active}>
                                <FaEdit className="mr-2"/> Edit Config
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                            <p className="flex justify-between md:justify-start md:gap-2">
                                <strong className="text-gray-600 dark:text-gray-400">Strategy:</strong> 
                                <span className="font-mono font-medium text-gray-900 dark:text-white">{bot?.strategy_name}</span>
                            </p>
                            <p className="flex justify-between md:justify-start md:gap-2">
                                <strong className="text-gray-600 dark:text-gray-400">Mode:</strong> 
                                <span className="font-mono font-medium text-gray-900 dark:text-white">{bot?.is_paper_trading ? 'Paper Trading' : 'Live Trading'}</span>
                            </p>
                            <p className="flex justify-between md:justify-start md:gap-2">
                                <strong className="text-gray-600 dark:text-gray-400">Dynamic Sizing:</strong> 
                                <span className="font-mono font-medium text-gray-900 dark:text-white">{bot?.use_dynamic_sizing ? 'Enabled' : 'Disabled'}</span>
                            </p>
                            <p className="flex justify-between md:justify-start md:gap-2">
                                <strong className="text-gray-600 dark:text-gray-400">Market Filter:</strong> 
                                <span className="font-mono font-medium text-gray-900 dark:text-white">{bot?.market_regime_filter_enabled ? 'Enabled' : 'Disabled'}</span>
                            </p>
                            <p className="flex justify-between md:justify-start md:gap-2">
                                <strong className="text-gray-600 dark:text-gray-400">Take Profit:</strong> 
                                <span className="font-mono font-bold text-success">{bot?.take_profit_percentage ? `${bot.take_profit_percentage}%` : 'Not Set'}</span>
                            </p>
                            <p className="flex justify-between md:justify-start md:gap-2">
                                <strong className="text-gray-600 dark:text-gray-400">Stop Loss:</strong> 
                                <span className="font-mono font-bold text-danger">{bot?.stop_loss_percentage ? `${bot.stop_loss_percentage}%` : 'Not Set'}</span>
                            </p>
                            
                            <div className="col-span-1 md:col-span-2 mt-2">
                                <strong className="block text-gray-600 dark:text-gray-400 mb-2">Parameters:</strong>
                                {/* JSON Box: Light Gray bg in light mode, Dark bg in dark mode */}
                                <pre className="text-xs bg-gray-50 dark:bg-primary border border-gray-200 dark:border-border-color p-4 rounded-lg overflow-x-auto font-mono text-gray-800 dark:text-gray-300">
                                    {JSON.stringify(bot?.strategy_params, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        {/* Trade History Header Fix */}
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                            <FaHistory className="mr-3 text-accent" />Trade History
                        </h2>
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
                                    <tbody className="divide-y divide-gray-200 dark:divide-border-color">
                                        {tradeLogs?.data.map(log => (
                                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-secondary">
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className={`px-4 py-3 font-bold ${log.side === 'buy' ? 'text-success' : 'text-danger'}`}>{log.side.toUpperCase()}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-white">{log.amount.toFixed(6)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-white">${log.price.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-white">${log.cost.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {tradeLogs?.data.length === 0 && <p className="text-center p-8 text-light-gray">No trades have been executed by this bot yet.</p>}
                            </div>
                        )}
                    </Card>
                </div>

                <Card className="lg:col-span-1 flex flex-col h-full">
                    {/* Header: Black in Light, White in Dark */}
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Live Operational Logs</h2>
                    
                    {/* Log Container: Light Gray bg (Light) vs Dark bg (Dark) */}
                    <div className="flex-grow h-96 bg-gray-50 dark:bg-primary border border-gray-200 dark:border-border-color p-4 rounded-lg overflow-y-auto flex flex-col-reverse shadow-inner">
                        <AnimatePresence>
                            {liveLogs.map((log, index) => (
                                <motion.div
                                    key={`${log.timestamp}-${index}`}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className={`text-xs p-2 font-mono border-b border-gray-200 dark:border-border-color/50 last:border-0 ${getLogColor(log.type)}`}
                                >
                                   {/* Timestamp: Muted Gray */}
                                   <span className="text-gray-400 dark:text-gray-600 mr-2">{new Date().toLocaleTimeString()}:</span>
                                   {log.message || `Event: ${log.type.replace(/_/g, ' ')}`}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        
                        {/* Placeholder Text: Visible Gray */}
                        {liveLogs.length === 0 && (
                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 m-auto italic">
                                Waiting for bot activity...
                            </p>
                        )}
                    </div>
                </Card>
            </div>
          )}
          {activeTab === 'analytics' && bot && (
                <AnalyticsTab bot={bot} />
            )}

            {/* --- EDIT MODAL --- */}
            <Modal title="Edit Bot Configuration" isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
                {bot.is_active && (
                    <Alert type="warning" message="You must stop the bot before editing its configuration." />
                )}
                {!bot.is_active && (
                    <CreateBotForm 
                        initialData={bot} 
                        onSubmit={handleUpdate} 
                        isLoading={updateMutation.isLoading}
                    />
                )}
                {bot.is_active && (
                    <div className="text-right mt-4">
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Close</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default BotDetailPage;