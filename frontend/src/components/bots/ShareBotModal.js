// src/components/bots/ShareBotModal.js

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion'; // <-- FIX: Import motion
import { FaLink, FaCopy } from 'react-icons/fa';
import { useApiMutation } from '../../hooks/useApiMutation';
import { publishBot, runSingleBacktest } from '../../api/apiService';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Textarea from '../common/Textarea';
import Spinner from '../common/Spinner';
import Input from '../common/Input';
import Alert from '../common/Alert';

const ShareBotModal = ({ isOpen, onClose, bot, initialBacktestResults = null }) => {
    // --- FIX: All hooks are now called unconditionally at the top level ---
    const [description, setDescription] = useState('');
    const [backtestMetrics, setBacktestMetrics] = useState(null);
    const [publishType, setPublishType] = useState('private');
    const [price, setPrice] = useState('');

    useEffect(() => {
        if (isOpen && bot) {
            setDescription(bot.description || '');
            setPublishType(bot.publish_type || 'private');
            setPrice(bot.price_usd_monthly || '');
            setBacktestMetrics(initialBacktestResults || bot.backtest_results_cache || null);
        }
    }, [isOpen, bot, initialBacktestResults]);

    const backtestMutation = useApiMutation(runSingleBacktest, {
        onSuccess: (data) => {
            toast.success('Pre-publish analysis complete!');
            setBacktestMetrics(data.data);
        },
    });

    const publishMutation = useApiMutation(
        ({ botId, publishData }) => publishBot(botId, publishData),
        {
            successMessage: 'Strategy settings updated successfully!',
            invalidateQueries: ['botDetails', bot?.id, 'marketplaceStrategies', 'userBots'],
            onSuccess: () => onClose(),
        }
    );

    // --- FIX: The conditional return is now placed AFTER all hooks have been called ---
    if (!bot) {
        return null;
    }

    const handleCopyLink = () => {
        const publicUrl = `${window.location.origin}/marketplace/bot/${bot.id}`;
        navigator.clipboard.writeText(publicUrl);
        toast.success('Public link copied to clipboard!');
    };

    const handleRunAnalysis = () => {
        setBacktestMetrics(null);
        const oneYearAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        backtestMutation.mutate({
            strategy_name: bot.strategy_name,
            params: bot.strategy_params,
            symbol: bot.symbol,
            exchange: bot.exchange,
            start_date: oneYearAgo,
            end_date: today,
        });
    };

     const handleSaveSettings = () => {
        if (publishType === 'subscription' && (!price || parseFloat(price) <= 0)) {
            return toast.error('Please enter a valid monthly price for the subscription.');
        }
        if (publishType !== 'private' && !backtestMetrics) {
            return toast.error('A valid backtest result is required to publish a strategy.');
        }

        publishMutation.mutate({
            botId: bot.id,
            publishData: {
                description,
                publish_type: publishType,
                price_usd_monthly: publishType === 'subscription' ? parseFloat(price) : null,
                backtest_results_cache: backtestMetrics,
            }
        });
    };

    const isSaveDisabled = (publishType !== 'private' && !backtestMetrics) || publishMutation.isLoading;

    // The rest of the JSX remains the same...
    return (
        <Modal title="Publish Strategy to Marketplace" isOpen={isOpen} onClose={onClose}>
            {/* ... (previous valid JSX) ... */}
             <div className="space-y-4">
                <Textarea label="Public Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your strategy, ideal market conditions, etc." maxLength={500}/>
                <div className="border-t border-light-border dark:border-border-color pt-4">
                    <h4 className="font-semibold text-light-heading dark:text-white mb-2">Marketplace Performance</h4>
                    {backtestMetrics ? (
                        <div className="bg-light-secondary dark:bg-primary p-4 rounded-lg border border-light-border dark:border-border-color">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                 <div><p className="text-xs text-light-muted">Return</p><p className={`font-bold ${backtestMetrics.total_return_pct >= 0 ? 'text-success' : 'text-danger'}`}>{backtestMetrics.total_return_pct.toFixed(1)}%</p></div>
                                 <div><p className="text-xs text-light-muted">Sharpe</p><p className="font-bold text-light-text dark:text-white">{backtestMetrics.sharpe_ratio.toFixed(2)}</p></div>
                                 <div><p className="text-xs text-light-muted">Max Drawdown</p><p className="font-bold text-light-text dark:text-white">{backtestMetrics.max_drawdown_pct.toFixed(1)}%</p></div>
                                 <div><p className="text-xs text-light-muted">Trades</p><p className="font-bold text-light-text dark:text-white">{backtestMetrics.total_trades}</p></div>
                            </div>
                            <Button onClick={handleRunAnalysis} isLoading={backtestMutation.isLoading} variant="secondary" size="sm" className="w-full mt-4">
                                Re-run Analysis
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center p-4 border-2 border-dashed border-light-border dark:border-border-color rounded-lg">
                            {backtestMutation.isLoading ? (
                                <div className="flex items-center justify-center text-light-muted"><Spinner size="sm" className="mr-2"/>Running standardized 1-year backtest...</div>
                            ) : (
                                <>
                                    <p className="text-sm text-light-muted mb-3">To share, you must run a standardized performance analysis.</p>
                                    <Button onClick={handleRunAnalysis} isLoading={backtestMutation.isLoading} variant="secondary">
                                        Run Pre-Publish Analysis
                                    </Button>
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
                        <label className="flex items-center space-x-3 cursor-pointer"><input type="radio" name="publishType" value="private" checked={publishType === 'private'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent bg-transparent focus:ring-accent"/> <span className="text-sm">Private (Only you can use it)</span></label>
                        <label className="flex items-center space-x-3 cursor-pointer"><input type="radio" name="publishType" value="public_free" checked={publishType === 'public_free'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent bg-transparent focus:ring-accent"/> <span className="text-sm">Public (Allow others to clone for free)</span></label>
                        <label className="flex items-center space-x-3 cursor-pointer"><input type="radio" name="publishType" value="subscription" checked={publishType === 'subscription'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent bg-transparent focus:ring-accent"/> <span className="text-sm">Subscription (Charge a monthly fee)</span></label>
                    </div>

                    {publishType === 'subscription' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="pl-6 pt-2">
                             <Input label="Price per Month (USD)" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g., 19.99" />
                        </motion.div>
                    )}
                </div>
                 {publishType !== 'private' && !backtestMetrics && <Alert type="warning" message="You must run the pre-publish analysis before making this strategy public." />}

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