import React, { useState, useMemo } from 'react';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';

// --- ROBUST HELPER for safely formatting numbers ---
const formatMetric = (value, digits = 2, suffix = '') => {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return <span className="text-gray-500">N/A</span>;
    }
    const numberValue = Number(value);
    // Color is applied on the cell (<td>) level now
    return `${numberValue.toFixed(digits)}${suffix}`;
};


const OptimizationResultsTable = ({ results }) => {
    // --- THIS IS THE FIX ---
    // 1. Call ALL hooks unconditionally at the top level of the component.
    const [sortConfig, setSortConfig] = useState({ key: 'sharpe_ratio', direction: 'descending' });

    const sortedResults = useMemo(() => {
        // Provide a default empty array to prevent errors if `results` is null/undefined
        let sortableItems = (results || []).map(r => ({
            params: r?.params ?? {},
            metrics: r?.metrics ?? {}
        }));

        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const valA = a.metrics[sortConfig.key] ?? -Infinity;
                const valB = b.metrics[sortConfig.key] ?? -Infinity;
                if (valA < valB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [results, sortConfig]);
    
    // 2. The guard clause (early return) is now placed AFTER all hooks have been called.
    if (!sortedResults || sortedResults.length === 0) {
        return <p className="text-light-gray p-4 text-center">No valid results to display.</p>;
    }

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <FaSort className="opacity-30" />;
        }
        return sortConfig.direction === 'ascending' ? <FaSortUp /> : <FaSortDown />;
    };
    
    const headers = [
        { key: 'params', label: 'Parameters' },
        { key: 'total_return_pct', label: 'Total Return (%)' },
        { key: 'sharpe_ratio', label: 'Sharpe Ratio' },
        { key: 'max_drawdown_pct', label: 'Max Drawdown (%)' },
        { key: 'total_trades', label: 'Total Trades' },
    ];

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-light-gray">
                <thead className="text-xs text-gray-700 font-bold dark:text-gray-400 uppercase bg-gray-100 dark:bg-primary/50">
                    <tr>
                        {headers.map(header => (
                            <th key={header.key} scope="col" className="px-4 py-3">
                                {header.key !== 'params' ? (
                                    <button onClick={() => requestSort(header.key)} className="flex items-center gap-1 hover:text-white">
                                        {header.label} {getSortIcon(header.key)}
                                    </button>
                                ) : (
                                    header.label
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                    {sortedResults.slice(0, 20).map((result, index) => {
                        const { metrics, params } = result;
                        
                        return (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-secondary border-b border-gray-200 dark:border-border-color">
                                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                                    {Object.entries(params).map(([key, value]) => (
                                        <div key={key}>{`${key}: ${value}`}</div>
                                    ))}
                                </td>
                                {/* Return: Bold */}
                                <td className={`px-4 py-3 font-bold ${(metrics.total_return_pct ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {formatMetric(metrics.total_return_pct, 2, '%')}
                                </td>
                                
                                {/* Sharpe: Black */}
                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                                    {formatMetric(metrics.sharpe_ratio, 2)}
                                </td>
                                
                                {/* Drawdown: Warning Color (unchanged) */}
                                <td className="px-4 py-3 text-warning font-semibold">
                                    {formatMetric(metrics.max_drawdown_pct, 2, '%')}
                                </td>
                                
                                {/* Trades: Dark Gray */}
                                <td className="px-4 py-3 text-gray-800 dark:text-white">
                                    {metrics.total_trades ?? 'N/A'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default OptimizationResultsTable;