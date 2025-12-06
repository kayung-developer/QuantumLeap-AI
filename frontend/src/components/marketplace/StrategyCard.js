// src/components/marketplace/StrategyCard.js

import React from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { Link } from 'react-router-dom';
import { FaUsers, FaCopy, FaGem, FaCheckCircle } from 'react-icons/fa';

const StrategyCard = ({ strategy, onClone, onSubscribe, isMutating, ownedByUser }) => {
    const perf = strategy.backtest_results_cache;
    const isSubscription = strategy.publish_type === 'subscription';
    const isFree = strategy.publish_type === 'public_free';

    // Helper for safe formatting
    const fmt = (val, d=2) => (parseFloat(val) || 0).toFixed(d);

    const renderActionButton = () => {
        if (ownedByUser) {
            return <Button variant="secondary" className="w-full" disabled><FaCheckCircle className="mr-2"/> You Own This</Button>;
        }
        if (isSubscription) {
            return (
                <Button onClick={() => onSubscribe(strategy)} className="w-full" isLoading={isMutating}>
                    <FaGem className="mr-2"/> Subscribe for ${strategy.price_usd_monthly}/mo
                </Button>
            );
        }
        if (isFree) {
            return (
                <Button onClick={() => onClone(strategy.id)} className="w-full" isLoading={isMutating}>
                    <FaCopy className="mr-2"/> Clone for Free
                </Button>
            );
        }
        return null;
    };

    return (
        <Link to={`/marketplace/bot/${strategy.id}`} className="relative flex">
            <Card className="flex flex-col justify-between overflow-hidden w-full transition-transform transform hover:-translate-y-1 hover:shadow-xl">
                {isSubscription && <div className="absolute top-0 right-0 bg-accent text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg z-10">PREMIUM</div>}

                <div>
                    <div className="flex items-start justify-between">
                        <div>
                            {/* Name: Black */}
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate" title={strategy.name}>{strategy.name}</h3>
                            {/* Subtitle: Dark Gray */}
                            <p className="text-sm text-gray-600 dark:text-light-gray font-medium">{strategy.strategy_name.replace(/_/g, ' ')} on {strategy.symbol}</p>
                        </div>
                        {/* Clone Count */}
                        <div className="flex items-center text-sm text-gray-500 dark:text-light-gray ml-2 flex-shrink-0"><FaUsers className="mr-1.5"/>{strategy.clone_count}</div>
                    </div>
                    
                    {/* Description: Charcoal */}
                    <p className="text-sm text-gray-700 dark:text-gray-300 my-3 h-10 overflow-hidden leading-relaxed">{strategy.description || 'No description provided.'}</p>

                    {perf && (
                        /* Stats Box: Light Gray Background in Light Mode */
                        <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 dark:bg-primary p-2 rounded-lg border border-gray-200 dark:border-border-color">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-light-gray font-bold uppercase">Return</p>
                                <p className={`font-bold ${perf.total_return_pct >= 0 ? 'text-success' : 'text-danger'}`}>{perf.total_return_pct.toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-light-gray font-bold uppercase">Sharpe</p>
                                <p className="font-bold text-gray-900 dark:text-white">{perf.sharpe_ratio.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-light-gray font-bold uppercase">Trades</p>
                                <p className="font-bold text-gray-900 dark:text-white">{perf.total_trades}</p>
                            </div>
                        </div>
                    )}
                </div>
                <div
                    className="mt-4 z-20"
                    onClick={(e) => e.preventDefault()}
                >
                    {renderActionButton()}
                </div>
            </Card>
        </Link>
    );
};

export default StrategyCard;