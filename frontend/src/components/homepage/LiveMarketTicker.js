// src/components/homepage/LiveMarketTicker.js

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketTicker } from '../../api/apiService';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

const TickerItem = ({ symbol, price, change }) => (
    <div className="flex items-center space-x-2 mx-6">
        <span className="text-sm font-bold text-light-muted dark:text-light-gray">{symbol}</span>
        <span className="text-sm font-mono text-light-text dark:text-white">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span className={`text-sm font-mono ${change >= 0 ? 'text-success' : 'text-danger'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
    </div>
);

const LiveMarketTicker = () => {
    const { isAuthenticated } = useAuth();
    const wsContext = useWebSocket(); // Get the context, which might be null
    const [marketData, setMarketData] = useState({});

    // --- Fallback Data Fetching using React Query for logged-out users ---
    const { data: apiData } = useQuery({
        queryKey: ['marketTicker'],
        queryFn: fetchMarketTicker,
        enabled: !isAuthenticated, // Only run this query if the user is NOT authenticated
        refetchInterval: 15000, // Refetch every 15 seconds
        onSuccess: (data) => {
            if (data?.data?.data) {
                setMarketData(data.data.data);
            }
        }
    });

    // --- Real-time Data using WebSockets for logged-in users ---
    useEffect(() => {
        if (isAuthenticated && wsContext?.messages) {
            const marketUpdate = wsContext.messages.find(msg => msg.type === 'market_update');
            if (marketUpdate?.data) {
                setMarketData(marketUpdate.data);
            }
        }
    }, [isAuthenticated, wsContext?.messages]);

    const tickerContent = Object.keys(marketData).length > 0
        ? Object.entries(marketData).map(([symbol, data]) => (
            <TickerItem key={symbol} symbol={symbol} price={data.price} change={data.change} />
          ))
        : [<div key="loading" className="text-sm text-light-muted dark:text-light-gray">Loading market data...</div>]; // Placeholder

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