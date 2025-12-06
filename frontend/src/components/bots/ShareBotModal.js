// src/components/bots/ShareBotModal.js

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { FaLink, FaCopy } from 'react-icons/fa';
import { useApiMutation } from '../../hooks/useApiMutation';
import { publishBot, runSingleBacktest, updateBot } from '../../api/apiService'; // Added updateBot
import Modal from '../common/Modal';
import Button from '../common/Button';
import Textarea from '../common/Textarea';
import Spinner from '../common/Spinner';
import Input from '../common/Input';
import Alert from '../common/Alert';

const ShareBotModal = ({ isOpen, onClose, bot, initialBacktestResults = null }) => {
    const [description, setDescription] = useState('');
    const [backtestMetrics, setBacktestMetrics] = useState(null);
    const [publishType, setPublishType] = useState('private');
    const [price, setPrice] = useState('');

    // --- Initialization Effect ---
    useEffect(() => {
        if (isOpen && bot) {
            setDescription(bot.description || '');
            setPublishType(bot.publish_type || 'private');
            setPrice(bot.price_usd_monthly || '');
            
            // Safely parse existing metrics from the bot object or props
            let parsedMetrics = null;
            if (initialBacktestResults) {
                parsedMetrics = initialBacktestResults;
            } else if (bot.backtest_results_cache) {
                try {
                    parsedMetrics = typeof bot.backtest_results_cache === 'string'
                        ? JSON.parse(bot.backtest_results_cache)
                        : bot.backtest_results_cache;
                } catch (e) {
                    console.error("Failed to parse backtest cache:", e);
                    parsedMetrics = null;
                }
            }
            
            // Validate that the object actually has data before setting state
            if (parsedMetrics && typeof parsedMetrics === 'object' && parsedMetrics.total_return_pct !== undefined) {
                 setBacktestMetrics(parsedMetrics);
            } else {
                 setBacktestMetrics(null);
            }
        }
    }, [isOpen, bot, initialBacktestResults]);

    // --- Mutation 1: Auto-Save Results to DB ---
    // This runs silently in the background after a backtest finishes
    const saveResultsMutation = useApiMutation(
        ({ botId, botData }) => updateBot({ botId, botData }),
        {
            invalidateQueries: ['botDetails', bot?.id, 'userBots'],
            // No success toast needed here, it's an internal sync
        }
    );

    // --- Mutation 2: Run Analysis ---
    const backtestMutation = useApiMutation(runSingleBacktest, {
        onSuccess: (data) => {
            if (data?.data && typeof data.data === 'object') {
                toast.success('Analysis complete & saved!');
                setBacktestMetrics(data.data);
                
                // CRITICAL FIX: Immediately save these results to the database.
                // This prevents the data from being lost if the user refreshes or changes tabs.
                saveResultsMutation.mutate({
                    botId: bot.id,
                    botData: { backtest_results_cache: JSON.stringify(data.data) }
                });
            } else {
                toast.error('Analysis failed or returned invalid data.');
            }
        },
    });

    // --- Mutation 3: Publish/Save Settings ---
    const publishMutation = useApiMutation(
        ({ botId, publishData }) => publishBot(botId, publishData),
        {
            successMessage: 'Strategy settings updated successfully!',
            invalidateQueries: ['botDetails', bot?.id, 'marketplaceStrategies', 'userBots'],
            onSuccess: () => onClose(),
        }
    );

    if (!bot) return null;

    const handleCopyLink = () => {
        const publicUrl = `${window.location.origin}/marketplace/bot/${bot.id}`;
        navigator.clipboard.writeText(publicUrl);
        toast.success('Public link copied to clipboard!');
    };

    const handleRunAnalysis = () => {
        setBacktestMetrics(null);
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        backtestMutation.mutate({
            strategy_name: bot.strategy_name,
            params: bot.strategy_params, 
            symbol: bot.symbol,
            exchange: bot.exchange,
            start_date: oneYearAgo.toISOString().split('T')[0],
            end_date: today.toISOString().split('T')[0],
        });
    };

     const handleSaveSettings = () => {
        // Validation: Price required for subscription
        if (publishType === 'subscription' && (!price || parseFloat(price) <= 0)) {
            return toast.error('Please enter a valid monthly price for the subscription.');
        }
        
        // Validation: Backtest required for public/subscription
        if (publishType !== 'private') {
            if (!backtestMetrics || backtestMetrics.total_return_pct === undefined) {
                return toast.error('A valid backtest result is required. Please run analysis first.');
            }
        }

        publishMutation.mutate({
            botId: bot.id,
            publishData: {
                description,
                publish_type: publishType,
                price_usd_monthly: publishType === 'subscription' ? parseFloat(price) : null,
                // Ensure we send the metrics currently in state, just in case
                backtest_results: backtestMetrics, 
            }
        });
    };

    const isSaveDisabled = (publishType !== 'private' && !backtestMetrics) || publishMutation.isLoading;
    
    // Helper to prevent "undefined" crashes
    const fmt = (val, d=2) => {
        const num = parseFloat(val);
        return isNaN(num) ? '0.00' : num.toFixed(d);
    };

    return (
        <Modal title="Publish Strategy to Marketplace" isOpen={isOpen} onClose={onClose}>
             <div className="space-y-4">
                <Textarea 
                    label="Public Description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Describe your strategy, ideal market conditions, risk profile, etc." 
                    maxLength={500}
                />
                
                <div className="border-t border-light-border dark:border-border-color pt-4">
                    <h4 className="font-semibold text-light-heading dark:text-white mb-2">Marketplace Performance</h4>
                    
                    {backtestMetrics && backtestMetrics.total_return_pct !== undefined ? (
                        <div className="bg-light-secondary dark:bg-primary p-4 rounded-lg border border-light-border dark:border-border-color">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                 <div>
                                     <p className="text-xs text-light-muted">Return</p>
                                     <p className={`font-bold ${(parseFloat(backtestMetrics.total_return_pct) || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                         {fmt(backtestMetrics.total_return_pct, 1)}%
                                     </p>
                                 </div>
                                 <div>
                                     <p className="text-xs text-light-muted">Sharpe</p>
                                     <p className="font-bold text-light-text dark:text-white">
                                         {fmt(backtestMetrics.sharpe_ratio, 2)}
                                     </p>
                                 </div>
                                 <div>
                                     <p className="text-xs text-light-muted">Max Drawdown</p>
                                     <p className="font-bold text-warning">
                                         {fmt(backtestMetrics.max_drawdown_pct, 1)}%
                                     </p>
                                 </div>
                                 <div>
                                     <p className="text-xs text-light-muted">Trades</p>
                                     <p className="font-bold text-light-text dark:text-white">
                                         {backtestMetrics.total_trades || 0}
                                     </p>
                                 </div>
                            </div>
                            <Button 
                                onClick={handleRunAnalysis} 
                                isLoading={backtestMutation.isLoading} 
                                variant="secondary" 
                                size="sm" 
                                className="w-full mt-4"
                            >
                                Re-run Analysis
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center p-4 border-2 border-dashed border-light-border dark:border-border-color rounded-lg">
                            {backtestMutation.isLoading ? (
                                <div className="flex items-center justify-center text-light-muted">
                                    <Spinner size="sm" className="mr-2"/>
                                    Running standardized 1-year backtest...
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-light-muted mb-3">To share, you must run a standardized performance analysis.</p>
                                    <Button onClick={handleRunAnalysis} isLoading={backtestMutation.isLoading} variant="secondary">
                                        Run Pre-Publish Analysis
                                    </Button>
                                    {backtestMutation.isError && <p className="text-xs text-danger mt-2">Analysis Failed. Check strategy configuration.</p>}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {bot.is_public && (
                    <div className="border-t border-light-border dark:border-border-color pt-4">
                        <label className="block text-sm font-medium text-light-heading dark:text-white mb-2">Shareable Link</label>
                        <div className="flex items-center gap-2">
                             <a href={`${window.location.origin}/marketplace/bot/${bot.id}`} target="_blank" rel="noopener noreferrer" className="flex-grow text-accent hover:underline truncate text-sm flex items-center gap-2">
                                <FaLink /> {`${window.location.origin}/marketplace/bot/${bot.id}`}
                             </a>
                             <Button variant="secondary" size="sm" onClick={handleCopyLink} title="Copy Link"><FaCopy /></Button>
                        </div>
                    </div>
                )}

                 <div className="border-t border-light-border dark:border-border-color pt-4 space-y-3">
                    <h4 className="font-semibold text-light-heading dark:text-white">Sharing Options</h4>
                    <div className="flex flex-col space-y-2">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="radio" name="publishType" value="private" checked={publishType === 'private'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent bg-transparent focus:ring-accent"/> 
                            <span className="text-sm text-light-text dark:text-light-gray">Private (Only you can use it)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="radio" name="publishType" value="public_free" checked={publishType === 'public_free'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent bg-transparent focus:ring-accent"/> 
                            <span className="text-sm text-light-text dark:text-light-gray">Public (Allow others to clone for free)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="radio" name="publishType" value="subscription" checked={publishType === 'subscription'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent bg-transparent focus:ring-accent"/> 
                            <span className="text-sm text-light-text dark:text-light-gray">Subscription (Charge a monthly fee)</span>
                        </label>
                    </div>

                    {publishType === 'subscription' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="pl-6 pt-2">
                             <Input 
                                label="Price per Month (USD)" 
                                type="number" 
                                value={price} 
                                onChange={e => setPrice(e.target.value)} 
                                placeholder="e.g., 19.99" 
                             />
                        </motion.div>
                    )}
                </div>
                
                 {publishType !== 'private' && (!backtestMetrics || backtestMetrics.total_return_pct === undefined) && (
                    <Alert type="warning" message="You must run and save the pre-publish analysis before making this strategy public." />
                 )}

                <div className="mt-6">
                    <Button onClick={handleSaveSettings} isLoading={publishMutation.isLoading} disabled={isSaveDisabled} className="w-full">
                        Save Settings
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ShareBotModal;