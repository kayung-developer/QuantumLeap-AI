import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../api/axiosInstance'; // Assuming you have this
import { useWebSocket } from './WebSocketContext';

const MarketDataContext = createContext(null);

export const useMarketData = () => useContext(MarketDataContext);

// API function to fetch the initial status
const fetchMarketDataStatus = async () => {
    const { data } = await axiosInstance.get('/public/market-data/status');
    return data;
};

export const MarketDataProvider = ({ children }) => {
    const [marketData, setMarketData] = useState({});
    const { messages, isConnected: isWsConnected } = useWebSocket() || {};

    // Fetch the initial health status via HTTP
    const { data: healthStatus, error: healthError } = useQuery({
        queryKey: ['marketDataHealth'],
        queryFn: fetchMarketDataStatus,
        refetchInterval: 30000, // Re-check health every 30 seconds
    });

    // Listen for live market data updates via WebSocket
    useEffect(() => {
        const latestMessage = messages?.[0];
        if (latestMessage && latestMessage.type === 'market_update') {
            setMarketData(prevData => ({ ...prevData, ...latestMessage.data }));
        }
    }, [messages]);

    const value = {
        marketData,
        healthStatus: isWsConnected ? healthStatus : { status: 'OUTAGE', source: 'WebSocket Disconnected' },
        isLoading: !healthStatus && !healthError,
    };

    return (
        <MarketDataContext.Provider value={value}>
            {children}
        </MarketDataContext.Provider>
    );
};