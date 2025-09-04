// src/components/market/CoPilot.js

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCopilotAnalysis } from '../../api/apiService'; // Add this to apiService.js
import Spinner from '../common/Spinner';
import { FaBrain, FaThumbsUp, FaThumbsDown, FaExclamationTriangle } from 'react-icons/fa';

// Add this to apiService.js:
// export const getCopilotAnalysis = (exchange, symbol) => axiosInstance.get(`/market/analysis/copilot/${exchange}/${symbol}`);

const CoPilot = ({ symbol, exchange }) => {
    const { data: analysis, isLoading, isError, error } = useQuery({
        queryKey: ['copilotAnalysis', symbol, exchange],
        queryFn: () => getCopilotAnalysis(exchange, symbol),
        refetchInterval: 60000, // Refetch analysis every 60 seconds
        staleTime: 55000,
    });

    const getSummaryIcon = (summary) => {
        if (summary?.includes('Bullish')) return <FaThumbsUp className="text-success text-3xl" />;
        if (summary?.includes('Bearish')) return <FaThumbsDown className="text-danger text-3xl" />;
        return <FaExclamationTriangle className="text-warning text-3xl" />;
    };

    return (
        <div>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
               <FaBrain className="mr-3 text-accent" /> AI Co-Pilot Analysis
            </h2>
            {isLoading && <div className="flex justify-center p-8"><Spinner /></div>}
            {isError && <p className="text-sm text-danger">Could not load analysis.</p>}
            {analysis && (
                <div className="space-y-4">
                    <div className="flex items-center space-x-4 p-4 bg-primary rounded-lg">
                        {getSummaryIcon(analysis.data.summary)}
                        <div>
                            <p className="text-sm text-light-gray">{symbol} Condition</p>
                            <p className="text-2xl font-bold text-white">{analysis.data.summary}</p>
                        </div>
                    </div>
                    {/* --- NEW: Display the richer ML-driven data --- */}
                    <div className="text-sm space-y-2">
                        <p className="flex justify-between">
                            <span className="text-light-gray">Optimus Score:</span>
                            <span className="font-semibold text-white">{analysis.data.score}</span>
                        </p>
                        <p className="flex justify-between">
                            <span className="text-light-gray">AI Prediction:</span>
                            <span className="font-semibold text-accent">{analysis.data.prediction}</span>
                        </p>
                        <div className="border-t border-border-color my-2"></div>
                         {Object.entries(analysis.data.indicators).map(([key, value]) => (
                            <p key={key} className="flex justify-between">
                                <span className="text-light-gray">{key}:</span>
                                <span className="font-semibold text-white font-mono">{value}</span>
                            </p>
                         ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoPilot;