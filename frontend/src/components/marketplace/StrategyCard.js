// src/components/marketplace/StrategyCard.js

import React from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { FaUsers, FaCopy, FaGem, FaCheckCircle, FaChartLine } from 'react-icons/fa';

const StrategyCard = ({ strategy, onClone, onSubscribe, isMutating, ownedByUser }) => {
    const perf = strategy.backtest_results_cache;
    const isSubscription = strategy.publish_type === 'subscription';
    const isFree = strategy.publish_type === 'public_free';

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
        <Card className="flex flex-col justify-between relative overflow-hidden">
            {isSubscription && <div className="absolute top-0 right-0 bg-accent text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg z-10">PREMIUM</div>}

            <div>
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-light-heading dark:text-white truncate" title={strategy.name}>{strategy.name}</h3>
                        <p className="text-sm text-light-muted dark:text-light-gray">{strategy.strategy_name.replace(/_/g, ' ')} on {strategy.symbol}</p>
                    </div>
                    <div className="flex items-center text-sm text-light-muted dark:text-light-gray ml-2"><FaUsers className="mr-1.5"/>{strategy.clone_count}</div>
                </div>
                <p className="text-sm text-light-muted dark:text-light-gray my-3 h-10 overflow-hidden">{strategy.description || 'No description provided.'}</p>

                {perf && (
                    <div className="grid grid-cols-3 gap-2 text-center bg-light-primary dark:bg-primary p-2 rounded-lg border border-light-border dark:border-border-color">
                        <div>
                            <p className="text-xs text-light-muted dark:text-light-gray">Return %</p>
                            <p className={`font-bold ${perf.total_return_pct >= 0 ? 'text-success' : 'text-danger'}`}>{perf.total_return_pct.toFixed(1)}%</p>
                        </div>
                        <div>
                            <p className="text-xs text-light-muted dark:text-light-gray">Sharpe</p>
                            <p className="font-bold text-light-text dark:text-white">{perf.sharpe_ratio.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-light-muted dark:text-light-gray">Trades</p>
                            <p className="font-bold text-light-text dark:text-white">{perf.total_trades}</p>
                        </div>
                    </div>
                )}
            </div>
            <div className="mt-4">
                {renderActionButton()}
            </div>
        </Card>
    );
};

export default StrategyCard;