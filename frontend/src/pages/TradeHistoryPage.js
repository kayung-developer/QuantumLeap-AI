import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMyTradeLogs } from '../api/apiService'; // Add this to apiService.js
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { FaBook } from 'react-icons/fa';

// A component for the table rows
const TradeRow = ({ trade }) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-secondary/50 transition-colors">
        <td className="p-4 text-sm text-gray-700 dark:text-light-gray font-medium">{new Date(trade.timestamp).toLocaleString()}</td>
        <td className="p-4 text-sm font-bold text-gray-900 dark:text-white">{trade.symbol}</td>
        <td className={`p-4 text-sm font-bold uppercase ${trade.side === 'buy' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {trade.side}
        </td>
        <td className="p-4 text-sm font-mono text-gray-800 dark:text-white text-right">{trade.amount.toFixed(6)}</td>
        <td className="p-4 text-sm font-mono text-gray-800 dark:text-white text-right">${trade.price.toFixed(2)}</td>
        <td className="p-4 text-sm font-mono text-gray-600 dark:text-gray-400 text-right">${trade.cost.toFixed(2)}</td>
        <td className="p-4 text-center">
            {trade.is_paper_trade ?
                <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 px-3 py-1 rounded-full text-xs font-bold border border-yellow-200 dark:border-transparent">Paper</span> :
                <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-3 py-1 rounded-full text-xs font-bold border border-green-200 dark:border-transparent">Live</span>
            }
        </td>
    </tr>
);

const TradeHistoryPage = () => {
    const [page, setPage] = useState(1);
    // Add state for filters later if needed

    const { data: tradeData, isLoading } = useQuery({
        queryKey: ['myTradeLogs', page],
        queryFn: () => fetchMyTradeLogs({ page }),
        keepPreviousData: true, // For a smoother pagination experience
    });

    const trades = tradeData?.data.items;
    const totalPages = tradeData?.data.total_pages || 1;

    return (
        <div>
            {/* Header: Black */}
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-8 flex items-center">
                <FaBook className="mr-3 text-accent"/> Trade History
            </h1>
            <Card>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-border-color">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 dark:bg-secondary text-xs font-bold text-gray-700 dark:text-gray-400 uppercase">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Symbol</th>
                                <th className="p-4">Side</th>
                                <th className="p-4 text-right">Amount</th>
                                <th className="p-4 text-right">Price</th>
                                <th className="p-4 text-right">Total Value</th>
                                <th className="p-4 text-center">Mode</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-border-color bg-white dark:bg-primary">
                            {isLoading && <tr><td colSpan="7" className="text-center p-8"><Spinner /></td></tr>}
                            
                            {!isLoading && trades?.map(trade => <TradeRow key={trade.id} trade={trade} />)}
                            
                            {!isLoading && trades?.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="text-center p-12">
                                        <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">No trades found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-6 p-2 border-t border-gray-100 dark:border-border-color pt-4">
                    <Button variant="secondary" onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}>
                        Previous
                    </Button>
                    <span className="text-sm font-bold text-gray-700 dark:text-light-gray">Page {page} of {totalPages}</span>
                    <Button variant="secondary" onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages}>
                        Next
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default TradeHistoryPage;