// src/pages/DashboardPage.js

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUserBots, fetchUserPortfolio } from '../api/apiService';
import { useAuth } from '../contexts/AuthContext';
import useWebSocketListener from '../hooks/useWebSocketListener';
import { Link } from 'react-router-dom';

// Import All Dashboard & Common Components
import StatCard from '../components/dashboard/StatCard';
import PortfolioDonutChart from '../components/dashboard/PortfolioDonutChart';
import TradingChart from '../components/trading/TradingChart';
import CoPilot from '../components/market/CoPilot';
import TradingTerminal from '../components/market/TradingTerminal';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import { FaRobot, FaDollarSign, FaChartPie, FaCheckCircle, FaPlus } from 'react-icons/fa';

// Configuration for the chart's symbol selectors
const SYMBOL_CONFIG = {
    crypto: {
        exchange: 'binance',
        symbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT']
    },
    forex: {
        exchange: 'binance', // Using a CCXT-compatible exchange for Forex data
        symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD']
    }
};

const DashboardPage = () => {
    const { profile } = useAuth();

    // State for the interactive chart section
    const [assetClass, setAssetClass] = useState('crypto');
    const [currentSymbol, setCurrentSymbol] = useState('BTC/USDT');

    // --- API Data Fetching ---
    const { data: botsResponse, isLoading: botsLoading, error: botsError } = useQuery({
        queryKey: ['userBots'],
        queryFn: fetchUserBots
    });

    const { data: portfolioResponse, isLoading: portfolioLoading, error: portfolioError } = useQuery({
        queryKey: ['userPortfolio'],
        queryFn: fetchUserPortfolio,
    });
    const realTimeActivity = useWebSocketListener((msg) => ['bot_status', 'trade_executed', 'error'].includes(msg.type));
    const isDashboardLoading = botsLoading || portfolioLoading;

    // --- Derived State and Calculations ---
    const activeBotsCount = useMemo(() => botsResponse?.data?.filter(b => b.is_active).length || 0, [botsResponse]);
    const portfolioValue = useMemo(() => portfolioResponse?.data?.reduce((sum, asset) => sum + asset.usd_value, 0) || 0, [portfolioResponse]);
    const totalPnl = useMemo(() => {
        if (!botsResponse?.data) return 0;
        return botsResponse.data.reduce((sum, bot) => sum + (bot.is_paper_trading ? bot.paper_pnl_usd : bot.live_pnl_usd), 0);
    }, [botsResponse]);

    const topBots = useMemo(() => {
        if (!botsResponse?.data) return [];
        return [...botsResponse.data]
            .sort((a, b) => {
                const pnlA = a.is_paper_trading ? a.paper_pnl_usd : a.live_pnl_usd;
                const pnlB = b.is_paper_trading ? b.paper_pnl_usd : b.live_pnl_usd;
                return pnlB - pnlA;
            })
            .slice(0, 5); // Show top 5
    }, [botsResponse]);

    const getDisplayName = () => profile?.profile?.first_name || profile?.email?.split('@')[0] || 'Trader';

    // --- Handler functions for the chart controls ---
    const handleAssetClassChange = (e) => {
        const newAssetClass = e.target.value;
        setAssetClass(newAssetClass);
        setCurrentSymbol(SYMBOL_CONFIG[newAssetClass].symbols[0]);
    };

    const chartConfig = SYMBOL_CONFIG[assetClass];

    return (
        <div className="space-y-8">
            {/* --- 1. Welcome Header --- */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-light-heading dark:text-white">Welcome Back, {getDisplayName()}!</h1>
                    <p className="text-light-muted dark:text-light-gray mt-1">Here's your trading performance overview.</p>
                </div>
                <Link to="/dashboard/bots">
                    <Button><FaPlus className="mr-2" /> Create New Bot</Button>
                </Link>
            </div>

            {/* --- Global Error Alerts --- */}
            {botsError && <Alert type="error" message={`Could not load bot data: ${botsError.message}`} />}
            {portfolioError && <Alert type="error" message={`Could not load portfolio data: ${portfolioError.message}`} />}

            {/* --- 2. Stat Cards Grid --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Portfolio Value" value={`$${portfolioValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<FaChartPie className="text-accent text-2xl"/>} isLoading={isDashboardLoading} />
                <StatCard title="Total P&L" value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`} icon={<FaDollarSign className="text-accent text-2xl"/>} changeType={totalPnl >= 0 ? 'positive' : 'negative'} isLoading={botsLoading} />
                <StatCard title="Total Bots" value={botsResponse?.data?.length || 0} icon={<FaRobot className="text-accent text-2xl"/>} isLoading={isDashboardLoading} />
                <StatCard title="Active Bots" value={activeBotsCount} icon={<FaCheckCircle className="text-accent text-2xl"/>} isLoading={isDashboardLoading} />
            </div>

            {/* --- 3. Interactive Trading Section --- */}
            <Card>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-2">
                    <h2 className="text-xl font-bold text-white flex-shrink-0">Trading View</h2>
                    <div className="flex-grow"></div>
                    <div>
                        <label className="text-xs text-light-gray mr-2">Asset Class</label>
                        <select value={assetClass} onChange={handleAssetClassChange} className="p-2 bg-secondary border border-border-color rounded-md">
                            <option value="crypto">Crypto</option>
                            <option value="forex">Forex</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-light-gray mr-2">Symbol</label>
                        <select value={currentSymbol} onChange={(e) => setCurrentSymbol(e.target.value)} className="p-2 bg-secondary border border-border-color rounded-md">
                            {chartConfig.symbols.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    {currentSymbol && (
                        <TradingChart symbol={currentSymbol} exchange={chartConfig.exchange} assetClass={assetClass} />
                    )}
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <CoPilot symbol={currentSymbol} exchange={chartConfig.exchange} />
                    <TradingTerminal symbol={currentSymbol} exchange={chartConfig.exchange} assetClass={assetClass}/>
                </div>
            </div>

            {/* --- 4. Portfolio and Bots Overview --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <PortfolioDonutChart data={portfolioResponse?.data} isLoading={portfolioLoading} />
                <Card>
                    <h2 className="text-xl font-semibold text-light-heading dark:text-white mb-4">Top Performing Bots</h2>
                    {botsLoading ? <div className="flex justify-center items-center h-full"><Spinner /></div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-light-muted dark:text-light-gray">
                                <thead className="text-xs uppercase bg-secondary">
                                    <tr>
                                        <th className="px-4 py-2">Name</th>
                                        <th className="px-4 py-2">Symbol</th>
                                        <th className="px-4 py-2 text-right">P&L</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-color">
                                    {topBots.length > 0 ? topBots.map(bot => {
                                        const pnl = bot.is_paper_trading ? bot.paper_pnl_usd : bot.live_pnl_usd;
                                        return (
                                            <tr key={bot.id} className="hover:bg-secondary">
                                                <td className="px-4 py-3 font-semibold text-white">{bot.name}</td>
                                                <td className="px-4 py-3 font-mono">{bot.symbol}</td>
                                                <td className={`px-4 py-3 text-right font-semibold font-mono ${pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                                                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan="3" className="text-center p-6">No bot data available.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default DashboardPage;