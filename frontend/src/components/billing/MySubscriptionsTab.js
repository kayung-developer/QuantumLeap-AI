// src/components/billing/MySubscriptionsTab.js

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMySubscriptions } from '../../api/apiService';
import Spinner from '../common/Spinner';
import Alert from '../common/Alert';
import Button from '../common/Button';
import { FaCheckCircle, FaTimesCircle, FaExclamationCircle } from 'react-icons/fa';

const statusInfo = {
    active: { icon: <FaCheckCircle className="text-success" />, color: 'text-success' },
    expired: { icon: <FaExclamationCircle className="text-warning" />, color: 'text-warning' },
    cancelled: { icon: <FaTimesCircle className="text-danger" />, color: 'text-danger' },
};

const MySubscriptionsTab = () => {
    const { data: subscriptions, isLoading, isError, error } = useQuery({
        queryKey: ['mySubscriptions'],
        queryFn: fetchMySubscriptions,
    });

    if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>;
    if (isError) return <Alert type="error" message={error.response?.data?.detail || 'Failed to load subscriptions.'} />;

    return (
        <div>
            <h3 className="text-xl font-bold text-light-heading dark:text-white mb-2">My Strategy Subscriptions</h3>
            <p className="text-sm text-light-muted dark:text-light-gray mb-6">
                Manage your active and past subscriptions to premium strategies from the marketplace.
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-light-muted dark:text-light-gray">
                    <thead className="text-xs text-gray-700 font-bold dark:text-gray-400 uppercase bg-gray-100 dark:bg-primary/50">
                        <tr>
                            <th className="px-4 py-3">Strategy Name</th>
                            <th className="px-4 py-3">Symbol</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Expires At</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-light-border dark:divide-border-color">
                        {subscriptions?.data.map(sub => (
                            <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-secondary border-b border-gray-200 dark:border-border-color">
                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{sub.strategy_bot_name}</td>
                                <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-400">{sub.strategy_bot_symbol}</td>
                                <td className={`px-4 py-3 font-semibold capitalize flex items-center gap-2 ${statusInfo[sub.status.toLowerCase()]?.color}`}>
                                    {statusInfo[sub.status.toLowerCase()]?.icon} {sub.status}
                                </td>
                                <td className="px-4 py-3">{new Date(sub.expires_at).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right">
                                    <Button size="sm" variant="danger" disabled={sub.status !== 'active'}>
                                        Cancel
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!isLoading && subscriptions?.data.length === 0 && (
                    <p className="text-center text-light-muted dark:text-light-gray p-8">You are not subscribed to any strategies.</p>
                )}
            </div>
        </div>
    );
};

export default MySubscriptionsTab;