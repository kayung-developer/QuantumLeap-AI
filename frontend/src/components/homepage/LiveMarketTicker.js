// src/components/homepage/LiveMarketTicker.js

import React, { useState, useEffect, useMemo } from 'react';
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

const TickerItem = React.memo(({ symbol, price, change }) => {
    // Ensure safe number formatting to prevent crashes
    const safePrice = Number(price) || 0;
    const safeChange = Number(change) || 0;

    return (
        <div className="flex items-center space-x-2 mx-6 flex-shrink-0">
            <span className="text-sm font-bold text-gray-700 dark:text-light-gray">{symbol}</span>
            <span className="text-sm font-mono text-gray-900 dark:text-white">
                ${safePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
            <span className={`text-sm font-mono font-bold flex items-center ${safeChange >= 0 ? 'text-success' : 'text-danger'}`}>
                {safeChange >= 0 ? '▲' : '▼'}{' '}{Math.abs(safeChange).toFixed(2)}%
            </span>
        </div>
    );
});

const LiveMarketTicker = () => {
    const { isAuthenticated } = useAuth();
    const wsContext = useWebSocket();
    const [localData, setLocalData] = useState([]);

    // --- Fallback Data Fetching using React Query ---
    const { data: apiData, isLoading } = useQuery({
        queryKey: ['marketTicker', MARKET_SYMBOLS],
        queryFn: () => fetchMarketTicker(MARKET_SYMBOLS),
        refetchInterval: 30000, 
        select: (data) => data.data, // Select the relevant part of the response
        enabled: !wsContext?.isConnected, // Only poll if WebSocket is disconnected
    });

    // --- EFFECT: Handle Data Updates from API or WebSocket ---
    useEffect(() => {
        // 1. If we have fresh API data, update state
        if (apiData) {
            // API usually returns an object { "BTC/USDT": { ... } } or an array. 
            // We normalize it here.
            if (Array.isArray(apiData)) {
                setLocalData(apiData);
            } else if (typeof apiData === 'object' && apiData !== null) {
                // Convert object to array: [{symbol: "BTC/USDT", ...data}]
                const arrayData = Object.entries(apiData).map(([symbol, data]) => ({
                    symbol,
                    ...data
                }));
                setLocalData(arrayData);
            }
        }

        // 2. If receiving websocket messages, merge them efficiently
        if (isAuthenticated && wsContext?.messages) {
            const marketUpdate = wsContext.messages.find(msg => msg.type === 'market_update');
            if (marketUpdate?.data) {
                setLocalData(prevData => {
                    // Create a map from previous data for quick lookup
                    const dataMap = new Map(prevData.map(item => [item.symbol, item]));
                    
                    // Process incoming update
                    // The backend sends { "BTC/USDT": {price: ..., change: ...}, ... }
                    const incomingData = marketUpdate.data;
                    
                    Object.entries(incomingData).forEach(([symbol, newData]) => {
                        dataMap.set(symbol, {
                            symbol,
                            price: newData.price,
                            change: newData.change || 0
                        });
                    });

                    return Array.from(dataMap.values());
                });
            }
        }
    }, [apiData, isAuthenticated, wsContext?.messages]);

    // --- MEMO: Prepare the items for rendering ---
    const tickerContent = useMemo(() => {
        if (!Array.isArray(localData) || localData.length === 0) return null;
        
        return localData.map(data => (
            <TickerItem 
                key={data.symbol} 
                symbol={data.symbol} 
                price={data.price} 
                change={data.change_24h || data.change} // Handle API vs WS key difference
            />
        ));
    }, [localData]);

    // --- Loading State ---
    if (isLoading && localData.length === 0) {
        return (
            <div className="w-full bg-white dark:bg-secondary border-y border-gray-200 dark:border-border-color overflow-hidden whitespace-nowrap">
                <div className="flex py-2 justify-center items-center h-[40px]">
                    <span className="text-sm text-gray-500 dark:text-light-gray animate-pulse">Loading market data...</span>
                </div>
            </div>
        );
    }

    // --- Empty State (Prevents crash if map is called on empty) ---
    if (!tickerContent) return null;

    return (
        <div className="w-full bg-white dark:bg-secondary border-y border-gray-200 dark:border-border-color overflow-hidden whitespace-nowrap">
            <motion.div
                className="flex py-2 items-center"
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