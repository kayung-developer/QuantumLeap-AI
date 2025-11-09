// src/components/homepage/LiveMarketTicker.js

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketTicker } from '../../api/apiService';
import { motion } from 'framer-motion';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useAuth } from '../../contexts/AuthContext';

// --- DEFINED LIST OF SYMBOLS TO DISPLAY ---
const MARKET_SYMBOLS = [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT',
    'ADA/USDT', 'AVAX/USDT', 'LINK/USDT', 'MATIC/USDT', 'LTC/USDT',
];

const TickerItem = React.memo(({ symbol, price, change }) => (
    <div className="flex items-center space-x-2 mx-6 flex-shrink-0">
        <span className="text-sm font-bold text-light-muted dark:text-light-gray">{symbol}</span>
        <span className="text-sm font-mono text-light-text dark:text-white">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
        <span className={`text-sm font-mono flex items-center ${change >= 0 ? 'text-success' : 'text-danger'}`}>
            {change >= 0 ? '▲' : '▼'}{' '}{Math.abs(change).toFixed(2)}%
        </span>
    </div>
));

const LiveMarketTicker = () => {
    const { isAuthenticated } = useAuth();
    const wsContext = useWebSocket();
    const [marketData, setMarketData] = useState([]);

    // --- Fallback Data Fetching using React Query for all users (provides initial state) ---
    const { data: apiData, isLoading } = useQuery({
        queryKey: ['marketTicker', MARKET_SYMBOLS],
        // Pass the defined symbols to the API fetcher function
        queryFn: () => fetchMarketTicker(MARKET_SYMBOLS),
        refetchInterval: 30000, // Refetch every 30 seconds
        select: (data) => data.data, // Select the relevant part of the response
    });

    // --- Set initial state from API, and update from WebSockets if available ---
    useEffect(() => {
        // Set initial data from the REST API call
        if (apiData) {
            setMarketData(apiData);
        }

        // If authenticated and receiving websocket messages, update the state in real-time
        if (isAuthenticated && wsContext?.messages) {
            const marketUpdate = wsContext.messages.find(msg => msg.type === 'market_update');
            if (marketUpdate?.data) {
                // This assumes marketUpdate.data is an array like the REST API response
                setMarketData(currentData => {
                    const newDataMap = new Map(currentData.map(item => [item.symbol, item]));
                    marketUpdate.data.forEach(newItem => {
                        newDataMap.set(newItem.symbol, newItem);
                    });
                    return Array.from(newDataMap.values());
                });
            }
        }
    }, [apiData, isAuthenticated, wsContext?.messages]);

    // --- Proper loading state before rendering the animation ---
    if (isLoading && marketData.length === 0) {
        return (
            <div className="w-full bg-light-secondary dark:bg-secondary border-y border-light-border dark:border-border-color overflow-hidden whitespace-nowrap">
                <div className="flex py-2 justify-center items-center h-[40px]">
                    <span className="text-sm text-light-muted dark:text-light-gray">Loading market data...</span>
                </div>
            </div>
        );
    }

    const tickerContent = marketData.map(data => (
        <TickerItem key={data.symbol} symbol={data.symbol} price={data.price} change={data.change_24h} />
    ));

    return (
        <div className="w-full bg-light-secondary dark:bg-secondary border-y border-light-border dark:border-border-color overflow-hidden whitespace-nowrap">
            <motion.div
                className="flex py-2"
                animate={{ x: ['0%', '-50%'] }}
                transition={{ ease: 'linear', duration: 40, repeat: Infinity }}
            >
                {/* Duplicate content for a seamless, infinite scroll effect */}
                {tickerContent}
                {tickerContent}
            </motion.div>
        </div>
    );
};

export default LiveMarketTicker;