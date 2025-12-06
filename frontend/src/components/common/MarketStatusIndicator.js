import React from 'react';
import { useMarketData } from '../../contexts/MarketDataContext';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaCircleNotch } from 'react-icons/fa';

const MarketStatusIndicator = () => {
    // --- THIS IS THE ROBUST FIX ---
    // 1. Call the hook and provide a default empty object to prevent destructuring errors.
    const marketDataContext = useMarketData();

    // 2. If the context is null or undefined, the component is being rendered
    //    outside its provider (e.g., on a public page). In this case, render nothing.
    if (!marketDataContext) {
        return null; 
    }

    // 3. Destructure the values now that we know the context exists.
    const { healthStatus, isLoading } = marketDataContext;
    
    if (isLoading) {
        return (
            <div className="flex items-center space-x-2 text-xs font-semibold text-gray-400">
                <FaCircleNotch className="animate-spin" />
                <span>Connecting...</span>
            </div>
        );
    }
    
    const statusConfig = {
        OPERATIONAL: {
            icon: <FaCheckCircle className="text-success" />,
            text: `Live (${healthStatus?.source})`,
            color: 'text-success',
        },
        DEGRADED: {
            icon: <FaExclamationTriangle className="text-warning" />,
            text: `Degraded (${healthStatus?.source})`,
            color: 'text-warning',
        },
        OUTAGE: {
            icon: <FaTimesCircle className="text-danger" />,
            text: `Offline (${healthStatus?.source})`,
            color: 'text-danger',
        },
    };
    
    const config = statusConfig[healthStatus?.status] || statusConfig.OUTAGE;
    
    return (
        <div className={`flex items-center space-x-2 text-xs font-semibold ${config.color}`}>
            {config.icon}
            <span>{config.text}</span>
        </div>
    );
};

export default MarketStatusIndicator;