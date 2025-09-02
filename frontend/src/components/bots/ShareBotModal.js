// src/components/bots/ShareBotModal.js

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publishBot, runSingleBacktest } from '../../api/apiService';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Textarea from '../common/Textarea';
import Alert from '../common/Alert';
import Spinner from '../common/Spinner';
import Input from '../common/Input';
import { FaLink } from 'react-icons/fa';
import toast from 'react-hot-toast';

const ShareBotModal = ({ isOpen, onClose, bot }) => {
    const queryClient = useQueryClient();
    const [description, setDescription] = useState(bot?.description || '');
    const [backtestResults, setBacktestResults] = useState(bot?.backtest_results_cache || null);
    const [backtestError, setBacktestError] = useState('');
    const [publishType, setPublishType] = useState(bot?.publish_type || 'private');
    const [price, setPrice] = useState(bot?.price_usd_monthly || '');

    const backtestMutation = useMutation({
        mutationFn: runSingleBacktest,
        onSuccess: (data) => {
            toast.success('Pre-publish analysis complete!');
            setBacktestResults(data.data);
            setBacktestError('');
        },
        onError: (err) => setBacktestError(err.response?.data?.detail || 'Backtest failed.'),
    });

    const publishMutation = useMutation({
        mutationFn: (publishData) => publishBot(bot.id, publishData),
        onSuccess: (data) => {
            const newStatus = data.data.is_public ? 'settings saved' : 'unpublished';
            toast.success(`Bot has been ${newStatus} successfully!`);
            queryClient.invalidateQueries({ queryKey: ['botDetails', bot.id] });
            queryClient.invalidateQueries({ queryKey: ['marketplaceStrategies'] });
            onClose();
        },
        onError: (err) => toast.error(`Failed to update: ${err.response?.data?.detail || err.message}`),
    });

    const handleCopyLink = () => {
        const publicUrl = `${window.location.origin}/bots/${bot.id}`;
        navigator.clipboard.writeText(publicUrl);
        toast.success('Public link copied to clipboard!');
    };

    const handleRunAnalysis = () => {
        setBacktestResults(null);
        backtestMutation.mutate({
            strategy_name: bot.strategy_name,
            params: bot.strategy_params,
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
         if (publishType !== 'private' && !backtestResults) {
             return toast.error('You must run the pre-publish analysis before sharing your bot.');
         }
        publishMutation.mutate({
            publish_type: publishType,
            price_usd_monthly: publishType === 'subscription' ? parseFloat(price) : null,
            description,
            backtest_results: backtestResults,
        });
    };

    const perf = backtestResults;

    return (
        <Modal title="Share Strategy to Marketplace" isOpen={isOpen} onClose={onClose}>
            <div className="space-y-4">
                <Textarea label="Public Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your strategy's logic, ideal market conditions, etc." maxLength={500}/>

                <div className="border-t border-border-color pt-4">
                    <p className="text-sm text-light-gray mb-2">To share publicly, first run a standardized 1-year backtest. The results will be displayed on the marketplace.</p>
                    <Button onClick={handleRunAnalysis} isLoading={backtestMutation.isLoading} variant="secondary" className="w-full">Run Pre-Publish Analysis</Button>
                </div>

                {bot.is_public && (
                    <div className="pt-2">
                        <label className="block text-sm font-medium text-white mb-2">Shareable Link</label>
                        <div className="flex gap-2"><Input readOnly value={`${window.location.origin}/bots/${bot.id}`} className="!bg-primary"/><Button variant="secondary" onClick={handleCopyLink} title="Copy Link"><FaLink /></Button></div>
                    </div>
                )}

                {backtestMutation.isLoading && <div className="flex items-center justify-center p-4 text-light-gray"><Spinner size="sm" className="mr-2"/> Running analysis...</div>}
                {backtestError && <Alert type="error" message={backtestError} />}

                {perf && (
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

                <div className="border-t border-border-color pt-4 space-y-3">
                    <h4 className="font-semibold text-white">Sharing Option</h4>
                    <div className="flex flex-col space-y-2">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="radio" name="publishType" value="private" checked={publishType === 'private'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent"/>
                            <span className="text-sm">Private (Keep this strategy for your use only)</span>
                        </label>
                         <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="radio" name="publishType" value="public_free" checked={publishType === 'public_free'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent"/>
                            <span className="text-sm">Public (Allow others to clone for free)</span>
                        </label>
                         <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="radio" name="publishType" value="subscription" checked={publishType === 'subscription'} onChange={(e) => setPublishType(e.target.value)} className="form-radio text-accent"/>
                             <span className="text-sm">Subscription (Charge a monthly fee for access)</span>
                        </label>
                    </div>

                    {publishType === 'subscription' && (
                        <div className="pl-6 pt-2">
                             <Input label="Price per Month (USD)" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g., 9.99" />
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <Button onClick={handleSaveSettings} isLoading={publishMutation.isLoading} className="w-full">
                        Save Sharing Settings
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ShareBotModal;