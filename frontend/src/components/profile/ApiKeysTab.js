// src/components/profile/ApiKeysTab.js

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserApiKeys, addUserApiKey, deleteUserApiKey } from '../../api/apiService';
import Input from '../common/Input';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import Alert from '../common/Alert';
import { FaKey, FaTrash, FaPlus } from 'react-icons/fa';

// --- Simplified configuration ---
const BROKER_CONFIG = {
    crypto: {
        label: "Crypto Exchange",
        brokers: [ { id: 'binance', name: 'Binance' }, { id: 'kucoin', name: 'KuCoin' }, { id: 'bybit', name: 'Bybit' } ],
    },
    forex: {
        label: "Forex Broker",
        brokers: [ { id: 'binance', name: 'Binance' }, { id: 'kucoin', name: 'KuCoin' }, { id: 'bybit', name: 'Bybit' } ],
    }
};

const AddApiKeyForm = ({ onAdd, isLoading }) => {
    const [assetClass, setAssetClass] = useState('crypto');
    const [exchange, setExchange] = useState(BROKER_CONFIG[assetClass].brokers[0].id);
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');

    const config = BROKER_CONFIG[assetClass];
    const fields = { apiKeyLabel: 'API Key', secretKeyLabel: 'Secret Key' }; // Standardized for CCXT

    const handleSubmit = (e) => {
        e.preventDefault();
        onAdd({ exchange, apiKey, secretKey, assetClass });
        setApiKey('');
        setSecretKey('');
    };

    const handleAssetClassChange = (e) => {
        const newAssetClass = e.target.value;
        setAssetClass(newAssetClass);
        setExchange(BROKER_CONFIG[newAssetClass].brokers[0].id);
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 bg-light-primary dark:bg-primary rounded-lg border border-light-border dark:border-border-color">
            <h3 className="text-lg font-bold text-light-heading dark:text-white mb-4">Add New Connection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">Asset Class</label>
                    <select value={assetClass} onChange={handleAssetClassChange} className="w-full p-2 bg-light-secondary dark:bg-secondary border border-light-border dark:border-border-color rounded-md">
                        <option value="crypto">Crypto</option>
                        <option value="forex">Forex</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">{config.label}</label>
                    <select value={exchange} onChange={e => setExchange(e.target.value)} className="w-full p-2 bg-light-secondary dark:bg-secondary border border-light-border dark:border-border-color rounded-md">
                        {config.brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="space-y-4">
                <Input label={fields.apiKeyLabel} value={apiKey} onChange={e => setApiKey(e.target.value)} required type="password" />
                <Input label={fields.secretKeyLabel} value={secretKey} onChange={e => setSecretKey(e.target.value)} required type="password" />
                <Button type="submit" isLoading={isLoading} className="w-full"><FaPlus className="mr-2"/>Add Connection</Button>
            </div>
        </form>
    );
};

const ApiKeysTab = () => {
    const queryClient = useQueryClient();
    const { data: keysResponse, isLoading, error } = useQuery({ queryKey: ['apiKeys'], queryFn: fetchUserApiKeys });

    const addMutation = useMutation({
        mutationFn: ({ exchange, apiKey, secretKey, assetClass }) => addUserApiKey(exchange, apiKey, secretKey, assetClass),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteUserApiKey,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }),
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <h3 className="text-xl font-bold text-light-heading dark:text-white mb-2">Your Connections</h3>
                <p className="text-sm text-light-muted dark:text-light-gray mb-6">
                    Bots will use these keys to trade on your behalf. We never store them in plain text.
                </p>
                {isLoading && <Spinner />}
                {error && <Alert type="error" message={error.response?.data?.detail || 'Failed to load keys.'} />}
                <div className="space-y-4">
                    {keysResponse?.data.map(key => (
                        <div key={key.id} className="flex items-center justify-between p-4 bg-white dark:bg-primary rounded-xl border border-gray-200 dark:border-border-color shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center">
                                <div className="p-2 bg-blue-50 dark:bg-secondary rounded-full mr-4">
                                    <FaKey className="text-accent" />
                                </div>
                                <div>
                                    {/* Exchange Name: Black */}
                                    <p className="font-bold text-gray-900 dark:text-white capitalize text-lg">{key.exchange}</p>
                                    {/* Masked Key: Dark Mono */}
                                    <p className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-1">{key.api_key_masked}</p>
                                </div>
                                {/* Badge: High Contrast */}
                                <span className="ml-4 text-xs font-bold uppercase bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">{key.asset_class}</span>
                            </div>
                            <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(key.id)} isLoading={deleteMutation.isLoading}>
                                <FaTrash />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="lg:col-span-1">
                <AddApiKeyForm onAdd={addMutation.mutate} isLoading={addMutation.isLoading} />
            </div>
        </div>
    );
};

export default ApiKeysTab;