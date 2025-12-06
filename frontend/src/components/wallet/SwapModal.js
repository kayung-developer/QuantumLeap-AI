// src/components/wallet/SwapModal.js

import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSwapQuote, executeSwap } from '../../api/apiService';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';
import Button from '../common/Button';
import Card from '../common/Card';
import Input from '../common/Input';
import Alert from '../common/Alert';
import toast from 'react-hot-toast';
import { FaSyncAlt } from 'react-icons/fa';

const SwapModal = ({ isOpen, onClose, balances }) => {
    const queryClient = useQueryClient();
    const [fromAsset, setFromAsset] = useState('USDT');
    const [toAsset, setToAsset] = useState('BTC');
    const [amount, setAmount] = useState('');

    // --- NEW STATE for the Quote & Confirm flow ---
    const [quote, setQuote] = useState(null);
    const [countdown, setCountdown] = useState(0);
    const [error, setError] = useState('');

    // --- Countdown Timer Effect ---
    useEffect(() => {
        if (countdown > 0) {
            const timer = setInterval(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        } else if (countdown === 0 && quote) {
            // When timer runs out, invalidate the quote
            setQuote(null);
            setError('Quote has expired. Please get a new one.');
        }
    }, [countdown, quote]);

    // Reset state when modal is closed or assets change
    useEffect(() => {
        setAmount('');
        setQuote(null);
        setCountdown(0);
        setError('');
    }, [isOpen, fromAsset, toAsset]);

    const quoteMutation = useMutation({
        mutationFn: () => getSwapQuote(fromAsset, toAsset, amount),
        onSuccess: (data) => {
            setQuote(data.data);
            const expiresIn = Math.floor((new Date(data.data.expires_at) - new Date()) / 1000);
            setCountdown(expiresIn);
            setError('');
        },
        onError: (err) => {
            setError(err.response?.data?.detail || 'Could not fetch quote.');
            setQuote(null);
        }
    });

    const executeMutation = useMutation({
        mutationFn: () => executeSwap(quote.quote_id),
        onSuccess: () => {
            toast.success('Swap executed successfully!');
            queryClient.invalidateQueries({ queryKey: ['walletBalances'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            onClose();
        },
        onError: (err) => toast.error(`Swap failed: ${err.response?.data?.detail || err.message}`),
    });

    const handleGetQuote = () => {
        if (!amount || parseFloat(amount) <= 0) {
            return setError('Please enter a valid amount.');
        }
        quoteMutation.mutate();
    };

    const handleSwapAssets = () => {
        setFromAsset(toAsset);
        setToAsset(fromAsset);
    };

    const availableAssets = balances.map(b => b.asset);

    const isConfirming = quote && countdown > 0;

    return (
        <Modal title="Swap Assets" isOpen={isOpen} onClose={onClose}>
            <div className="space-y-4">
                {error && <Alert type="error" message={error} />}

                {/* From Asset */}
                <div>
                    <label className="text-sm text-light-gray">From</label>
                    <div className="flex gap-2">
                        <select value={fromAsset} onChange={e => setFromAsset(e.target.value)} disabled={isConfirming} className="w-1/3 p-2 bg-primary border border-border-color rounded-md">
                            {availableAssets.map(asset => <option key={asset} value={asset}>{asset}</option>)}
                        </select>
                        <Input type="number" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)} disabled={isConfirming} />
                    </div>
                </div>

                <div className="flex justify-center">
                    <Button variant="secondary" onClick={handleSwapAssets} disabled={isConfirming}><FaSyncAlt /></Button>
                </div>

                {/* To Asset */}
                <div>
                    <label className="text-sm text-light-gray">To</label>
                    <div className="flex gap-2">
                         <select value={toAsset} onChange={e => setToAsset(e.target.value)} disabled={isConfirming} className="w-1/3 p-2 bg-primary border border-border-color rounded-md">
                            {['BTC', 'ETH', 'USDT'].map(asset => <option key={asset} value={asset}>{asset}</option>)}
                        </select>
                        <Input type="text" value={isConfirming ? `≈ ${parseFloat(quote.amount_out).toFixed(8)}` : '0.0'} readOnly className="!bg-primary/50"/>
                    </div>
                </div>

                {/* --- NEW: Confirmation View --- */}
                {isConfirming ? (
                    <Card className="!p-4 bg-primary border-accent">
                        <p className="text-sm text-light-gray">1 {fromAsset} ≈ {parseFloat(quote.rate).toFixed(6)} {toAsset}</p>
                        <p className="text-xs text-light-gray">Fee: {parseFloat(quote.fee).toFixed(8)} {toAsset}</p>
                        <p className="text-center font-bold text-accent mt-2">Quote expires in {countdown}s</p>
                    </Card>
                ) : (
                    <div className="text-xs text-light-gray text-center h-10 flex items-center justify-center">
                        {quoteMutation.isLoading && <Spinner size="sm" />}
                    </div>
                )}

                {/* --- NEW: Dynamic Button --- */}
                {isConfirming ? (
                     <Button onClick={() => executeMutation.mutate()} isLoading={executeMutation.isLoading} className="w-full">
                        Confirm Swap
                    </Button>
                ) : (
                    <Button onClick={handleGetQuote} isLoading={quoteMutation.isLoading} className="w-full">
                        Get Quote
                    </Button>
                )}
            </div>
        </Modal>
    );
};

export default SwapModal;