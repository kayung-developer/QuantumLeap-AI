import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMyTradeLogs } from '../api/apiService'; // Add this to apiService.js
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { FaBook } from 'react-icons/fa';

// A component for the table rows
const TradeRow = ({ trade }) => (
    <tr className="border-b border-border-color hover:bg-secondary">
        <td className="p-3 text-sm text-light-gray">{new Date(trade.timestamp).toLocaleString()}</td>
        <td className="p-3 text-sm font-semibold text-white">{trade.symbol}</td>
        <td className={`p-3 text-sm font-bold ${trade.side === 'buy' ? 'text-success' : 'text-danger'}`}>
            {trade.side.toUpperCase()}
        </td>
        <td className="p-3 text-sm font-mono text-white">{trade.amount.toFixed(6)}</td>
        <td className="p-3 text-sm font-mono text-white">${trade.price.toFixed(2)}</td>
        <td className="p-3 text-sm font-mono text-light-gray">${trade.cost.toFixed(2)}</td>
        <td className="p-3 text-xs">
            {trade.is_paper_trade ?
                <span className="bg-yellow-900 text-yellow-300 px-2 py-1 rounded-full">Paper</span> :
                <span className="bg-green-900 text-green-300 px-2 py-1 rounded-full">Live</span>
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
            <h1 className="text-3xl font-bold text-white mb-6 flex items-center">
                <FaBook className="mr-3 text-accent"/> Trade History
            </h1>
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-secondary text-xs text-light-gray uppercase">
                                <th className="p-3">Date</th>
                                <th className="p-3">Symbol</th>
                                <th className="p-3">Side</th>
                                <th className="p-3">Amount</th>
                                <th className="p-3">Price</th>
                                <th className="p-3">Total Value</th>
                                <th className="p-3">Mode</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <tr><td colSpan="7" className="text-center p-8"><Spinner /></td></tr>}
                            {!isLoading && trades?.map(trade => <TradeRow key={trade.id} trade={trade} />)}
                            {!isLoading && trades?.length === 0 && <tr><td colSpan="7" className="text-center p-8 text-light-gray">No trades found.</td></tr>}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-4 p-2">
                    <Button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}>
                        Previous
                    </Button>
                    <span className="text-sm text-light-gray">Page {page} of {totalPages}</span>
                    <Button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages}>
                        Next
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default TradeHistoryPage;