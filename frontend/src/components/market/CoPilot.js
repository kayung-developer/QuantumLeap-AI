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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
               <FaBrain className="mr-3 text-accent" /> AI Co-Pilot Analysis
            </h2>
            {isLoading && <div className="flex justify-center p-8"><Spinner /></div>}
            {isError && <p className="text-sm text-danger">Could not load analysis.</p>}
            {analysis && (
                <div className="space-y-4">
                    {/* Summary Card */}
                    <div className="flex items-center space-x-4 p-5 bg-gray-50 dark:bg-primary rounded-xl border border-gray-200 dark:border-border-color">
                        {getSummaryIcon(analysis.data.summary)}
                        <div>
                            {/* Label: Dark Gray */}
                            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{symbol} Condition</p>
                            {/* Result: Black */}
                            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{analysis.data.summary}</p>
                        </div>
                    </div>
                    
                    <div className="text-sm space-y-3 pt-2">
                        <p className="flex justify-between border-b border-gray-100 dark:border-border-color pb-2">
                            <span className="text-gray-600 dark:text-light-gray font-medium">Optimus Score:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{analysis.data.score}</span>
                        </p>
                        {/* ... repeat pattern for other items ... */}
                         {Object.entries(analysis.data.indicators).map(([key, value]) => (
                            <p key={key} className="flex justify-between">
                                <span className="text-gray-600 dark:text-light-gray">{key}:</span>
                                <span className="font-bold text-gray-900 dark:text-white font-mono">{value}</span>
                            </p>
                         ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoPilot;