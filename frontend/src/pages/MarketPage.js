// src/pages/MarketPage.js

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import TradingChart from '../components/trading/TradingChart';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import { fetchMarketSentiment } from '../api/apiService';
import { FaNewspaper, FaSearch, FaChartLine } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import UpgradePrompt from '../components/common/UpgradePrompt';
import CoPilot from '../components/market/CoPilot';
import TradingTerminal from '../components/market/TradingTerminal';


const MarketPage = () => {
    const { profile } = useAuth();
    const [activeSymbol, setActiveSymbol] = useState('BTC/USDT');
    const [symbolSearch, setSymbolSearch] = useState('BTC/USDT');

    // For sentiment analysis
    const [sentimentQuery, setSentimentQuery] = useState('Bitcoin');
    const [sentimentSearchTerm, setSentimentSearchTerm] = useState('Bitcoin');

    const canUseSentiment = profile?.subscription_plan === 'premium' || profile?.subscription_plan === 'ultimate' || profile?.role === 'superuser';

    const { data: sentimentData, isLoading, error, refetch } = useQuery({
        queryKey: ['sentiment', sentimentQuery],
        queryFn: () => fetchMarketSentiment(sentimentQuery),
        enabled: false, // Only fetch on manual trigger
    });

    // Fetch initial sentiment on page load
    useEffect(() => {
        if (canUseSentiment) {
            refetch();
        }
    }, [canUseSentiment, refetch]);


    const handleSymbolSearch = (e) => {
        e.preventDefault();
        setActiveSymbol(symbolSearch.toUpperCase());
    };

    const handleSentimentSearch = (e) => {
        e.preventDefault();
        if (sentimentSearchTerm) {
            setSentimentQuery(sentimentSearchTerm);
            // The key changing will trigger refetch via useEffect
        }
    };

     useEffect(() => {
        if (sentimentQuery && canUseSentiment) {
            refetch();
        }
    }, [sentimentQuery, canUseSentiment, refetch]);


    const getSentimentColor = (score) => {
        if (score > 0.05) return 'text-success';
        if (score < -0.05) return 'text-danger';
        return 'text-warning';
    };

    const getSentimentLabel = (score) => {
        if (score > 0.05) return 'Positive';
        if (score < -0.05) return 'Negative';
        return 'Neutral';
    };

    return (
        <div>
            {/* --- Header with Symbol Search --- */}
             <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center">
                        <FaChartLine className="mr-3 text-accent" />
                        Market Analysis
                    </h1>
                    <p className="text-light-gray mt-1">Live charts and AI-powered sentiment analysis.</p>
                </div>
                <form onSubmit={handleSymbolSearch} className="flex gap-2 w-full md:w-auto">
                    <Input
                        placeholder="e.g., ETH/USDT"
                        value={symbolSearch}
                        onChange={(e) => setSymbolSearch(e.target.value)}
                        className="w-full md:w-48"
                    />
                    <Button type="submit">
                        <FaSearch />
                    </Button>
                </form>
            </div>

            {/* --- Main Grid --- */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                {/* --- Live Chart (Main Area) --- */}
                <div className="xl:col-span-3">
                    <Card className="!p-0 overflow-hidden">
                        {/* The TradingView widget has its own loading spinner */}
                        <TradingChart symbol={activeSymbol} />
                    </Card>
                </div>

                {/* --- Analysis Tools (Sidebar) --- */}
                <div className="xl:col-span-1 space-y-6">
                    <TradingTerminal symbol={activeSymbol} exchange="binance" />
                    <Card>
                        <CoPilot symbol={activeSymbol} exchange="binance" />
                    </Card>
                    <Card>
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                           <FaNewspaper className="mr-3 text-accent" /> Market Sentiment
                        </h2>
                        {canUseSentiment ? (
                            <>
                                <form onSubmit={handleSentimentSearch} className="flex gap-2 mb-4">
                                    <Input
                                        placeholder="e.g., Ethereum"
                                        value={sentimentSearchTerm}
                                        onChange={(e) => setSentimentSearchTerm(e.target.value)}
                                    />
                                    <Button type="submit" isLoading={isLoading}><FaSearch /></Button>
                                </form>

                                {isLoading && <div className="flex justify-center p-4"><Spinner /></div>}
                                {error && <Alert type="error" message={error.response?.data?.detail || error.message} />}
                                {sentimentData && (
                                    <div className="text-center p-4 border-t border-border-color mt-4">
                                        <p className="text-lg text-light-gray">
                                            Sentiment for <span className="font-bold text-white">{sentimentQuery}</span>
                                        </p>
                                        <p className={`text-5xl font-bold my-2 ${getSentimentColor(sentimentData.data.compound)}`}>
                                            {getSentimentLabel(sentimentData.data.compound)}
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            Compound Score: {sentimentData.data.compound.toFixed(4)}
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <UpgradePrompt featureName="Market Sentiment Analysis" requiredPlan="Premium" />
                        )}
                    </Card>

                    {/* Placeholder for another analysis tool */}
                    <Card>
                        <h2 className="text-xl font-semibold text-white">Order Book (Coming Soon)</h2>
                        <p className="text-light-gray mt-2 text-sm">Real-time market depth and order book analysis will be available here.</p>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default MarketPage;