// src/components/strategylab/OptimizationResultsTable.js

import React, { useState, useMemo } from 'react';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';

const OptimizationResultsTable = ({ results }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'sharpe_ratio', direction: 'descending' });

    const sortedResults = useMemo(() => {
        let sortableItems = [...results];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                if (a.metrics[sortConfig.key] < b.metrics[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a.metrics[sortConfig.key] > b.metrics[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [results, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <FaSort />;
        if (sortConfig.direction === 'ascending') return <FaSortUp />;
        return <FaSortDown />;
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
                <thead className="text-xs text-gray-400 uppercase bg-primary/50">
                    <tr>
                        {headers.map(header => (
                            <th key={header.key} scope="col" className="px-4 py-3">
                                {header.key !== 'params' ? (
                                    <button onClick={() => requestSort(header.key)} className="flex items-center gap-1">
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
                    {sortedResults.slice(0, 20).map((result, index) => (
                        <tr key={index} className="hover:bg-secondary">
                            <td className="px-4 py-3 font-mono text-xs text-white">{JSON.stringify(result.params)}</td>
                            <td className={`px-4 py-3 font-semibold ${result.metrics.total_return_pct >= 0 ? 'text-success' : 'text-danger'}`}>{result.metrics.total_return_pct.toFixed(2)}</td>
                            <td className="px-4 py-3 font-semibold text-white">{result.metrics.sharpe_ratio.toFixed(2)}</td>
                            <td className="px-4 py-3 text-warning">{result.metrics.max_drawdown_pct.toFixed(2)}</td>
                            <td className="px-4 py-3 text-white">{result.metrics.total_trades}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default OptimizationResultsTable;