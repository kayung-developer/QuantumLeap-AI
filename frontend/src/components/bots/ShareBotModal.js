import React, { useState, useEffect } from 'react';
import { useApiMutation } from '../../hooks/useApiMutation'; // Use our robust hook
import { publishBot, runSingleBacktest } from '../../api/apiService';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Textarea from '../common/Textarea';
import Spinner from '../common/Spinner';
import Input from '../common/Input';
import { FaLink } from 'react-icons/fa';
import toast from 'react-hot-toast';

const ShareBotModal = ({ isOpen, onClose, bot, initialBacktestResults = null }) => {
    const [description, setDescription] = useState(bot?.description || '');
    // State now holds just the performance metrics
    const [backtestMetrics, setBacktestMetrics] = useState(bot?.backtest_results_cache || null);
    const [publishType, setPublishType] = useState(bot?.publish_type || 'private');
    const [price, setPrice] = useState(bot?.price_usd_monthly || '');

    // Load the initial results passed from the Strategy Lab when the modal opens
    useEffect(() => {
        if (initialBacktestResults) {
            setBacktestMetrics(initialBacktestResults);
        }
    }, [initialBacktestResults, isOpen]); // Rerun if the modal is reopened

    const backtestMutation = useApiMutation(runSingleBacktest, {
        onSuccess: (data) => {
            toast.success('Pre-publish analysis complete!');
            setBacktestMetrics(data.data); // The API returns the metrics directly
        },
    });

    const publishMutation = useApiMutation(
        // The mutation function now correctly expects an object with botId and publishData
        ({ botId, publishData }) => publishBot(botId, publishData),
        {
            successMessage: 'Strategy settings saved successfully!',
            invalidateQueries: ['botDetails', 'marketplaceStrategies', 'userBots'],
            onSuccess: () => {
                onClose(); // Close the modal on success
            }
        }
    );

    const handleCopyLink = () => {
        const publicUrl = `${window.location.origin}/marketplace/strategy/${bot.id}`;
        navigator.clipboard.writeText(publicUrl);
        toast.success('Public link copied to clipboard!');
    };

    const handleRunAnalysis = () => {
        setBacktestMetrics(null);
        backtestMutation.mutate({
            strategy_name: bot.strategy_name,
            params: bot.strategy_params, // Make sure bot object includes these details
            symbol: bot.symbol,
            exchange: bot.exchange,
            start_date: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
        });
    };

     const handleSaveSettings = () => {
        if (publishType === 'subscription' && (!price || parseFloat(price) <= 0)) {
            return toast.error('Please enter a valid price for the subscription.');
        }
         if (publishType !== 'private' && !backtestMetrics) {
             return toast.error('You must have valid backtest results before sharing your bot.');
         }

        publishMutation.mutate({
            botId: bot.id,
            publishData: {
                publish_type: publishType,
                price_usd_monthly: publishType === 'subscription' ? parseFloat(price) : null,
                description,
                backtest_results: backtestMetrics, // Send the metrics object
            }
        });
    };

    // --- THIS IS THE CRASH FIX ---
    // The 'perf' constant now directly references the metrics state.
    // The JSX will safely check if 'perf' exists before trying to render its properties.
    const perf = backtestMetrics;

    return (
        <Modal title="Publish Strategy to Marketplace" isOpen={isOpen} onClose={onClose}>
            <div className="space-y-4">
                <Textarea label="Public Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your strategy, ideal market conditions, etc." maxLength={500}/>

                {/* This UI is now cleaner, showing the results or the button to get them */}
                {!perf ? (
                    <div className="border-t border-border-color pt-4">
                        <p className="text-sm text-light-gray mb-2">To share publicly, first run a standardized 1-year backtest. The results will be displayed on the marketplace.</p>
                        <Button onClick={handleRunAnalysis} isLoading={backtestMutation.isLoading} variant="secondary" className="w-full">
                            Run Pre-Publish Analysis
                        </Button>
                    </div>
                ) : (
                    <div className="bg-primary p-4 rounded-lg border border-border-color">
                        <h4 className="font-semibold text-white mb-2">Analysis Results:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                             <div><p className="text-xs text-light-gray">Return</p><p className={`font-bold ${perf.total_return_pct > 0 ? 'text-success' : 'text-danger'}`}>{perf.total_return_pct.toFixed(1)}%</p></div>
                             <div><p className="text-xs text-light-gray">Buy & Hold</p><p className="font-bold text-white">{perf.buy_and_hold_return_pct.toFixed(1)}%</p></div>
                             <div><p className="text-xs text-light-gray">Sharpe</p><p className="font-bold text-white">{perf.sharpe_ratio.toFixed(2)}</p></div>
                             <div><p className="text-xs text-light-gray">Trades</p><p className="font-bold text-white">{perf.total_trades}</p></div>
                        </div>
                    </div>
                )}

                {backtestMutation.isLoading && <div className="flex items-center justify-center p-4 text-light-gray"><Spinner size="sm" className="mr-2"/> Running analysis...</div>}

                {bot.is_public && (
                    <div className="pt-2">
                        <label className="block text-sm font-medium text-white mb-2">Shareable Link</label>
                        <div className="flex gap-2"><Input readOnly value={`${window.location.origin}/marketplace/strategy/${bot.id}`} className="!bg-primary"/><Button variant="secondary" onClick={handleCopyLink} title="Copy Link"><FaLink /></Button></div>
                    </div>
                )}

                <div className="border-t border-border-color pt-4 space-y-3">
                    <h4 className="font-semibold text-white">Sharing Option</h4>
                    <div className="flex flex-col space-y-2">
                        <label className="flex items-center space-x-3 cursor-pointer"><input type="radio" name="publishType" value="private" checked={publishType === 'private'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent"/> <span className="text-sm">Private (Keep for your use only)</span></label>
                        <label className="flex items-center space-x-3 cursor-pointer"><input type="radio" name="publishType" value="public_free" checked={publishType === 'public_free'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent"/> <span className="text-sm">Public (Allow others to clone for free)</span></label>
                        <label className="flex items-center space-x-3 cursor-pointer"><input type="radio" name="publishType" value="subscription" checked={publishType === 'subscription'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent"/> <span className="text-sm">Subscription (Charge a monthly fee)</span></label>
                    </div>

                    {publishType === 'subscription' && (
                        <div className="pl-6 pt-2">
                             <Input label="Price per Month (USD)" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g., 19.99" />
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <Button onClick={handleSaveSettings} isLoading={publishMutation.isLoading} className="w-full">
                        Save & Publish Settings
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ShareBotModal;