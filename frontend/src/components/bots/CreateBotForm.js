// src/components/bots/CreateBotForm.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Input from '../common/Input';
import Button from '../common/Button';
import CheckboxWithTooltip from '../common/CheckboxWithTooltip';

// --- CONFIGURATION OBJECTS ---
// These define the dynamic options for the form.

const BROKER_CONFIG = {
    crypto: {
        brokers: ['binance', 'kucoin', 'bybit'], // Updated list
        symbols: [
            'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
            'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'SHIB/USDT', 'DOT/USDT',
            'LINK/USDT', 'TRX/USDT', 'MATIC/USDT', 'LTC/USDT', 'ATOM/USDT',
            'NEAR/USDT', 'UNI/USDT', 'XLM/USDT', 'ICP/USDT', 'ETC/USDT'
        ]
    },
    forex: {
        brokers: ['binance', 'kucoin', 'bybit'], // Forex supported by major exchanges
        symbols: [
            'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD',
            'USD/CAD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY',
            'GBP/CHF', 'AUD/NZD', 'EUR/AUD', 'GBP/CAD', 'EUR/CAD', 'USD/MXN',
            'USD/ZAR', 'USD/INR'
        ]
    }
};

const STRATEGY_CONFIG = {
    "TradingView_Alert": [], // No parameters needed for this
    "RSI_MACD_Crossover": [{ name: "rsi_period", label: "RSI Period", default: 14, type: "number" }, { name: "macd_fast", label: "MACD Fast", default: 12, type: "number" }, { name: "macd_slow", label: "MACD Slow", default: 26, type: "number" }],
    "MA_Cross": [{ name: "short_window", label: "Short Window", default: 50, type: "number" }, { name: "long_window", label: "Long Window", default: 200, type: "number" }],
    "Bollinger_Bands": [{ name: "window", label: "Window", default: 20, type: "number" }, { name: "std_dev", label: "Standard Dev.", default: 2.0, type: "number" }],
    "Smart_Money_Concepts": [{ name: "risk_reward_ratio", label: "Risk/Reward Ratio", default: 2.0, type: "number" }],
    "Grid_Trading": [{ name: "upper_price", label: "Upper Price", default: 70000, type: "number" }, { name: "lower_price", label: "Lower Price", default: 60000, type: "number" }, { name: "num_grids", label: "Number of Grids", default: 10, type: "number" }],
};

const CreateBotForm = ({ onSubmit, isLoading }) => {
    const { profile } = useAuth();
    const isPremiumOrHigher = profile?.subscription_plan === 'premium' || profile?.subscription_plan === 'ultimate';
    const isUltimate = profile?.subscription_plan === 'ultimate';

    const [botData, setBotData] = useState({
        name: '',
        asset_class: 'crypto',
        strategy_name: 'TradingView_Alert', // Default to the new strategy
        symbol: 'BTC/USDT',
        exchange: 'binance',
        is_paper_trading: true,
        market_type: 'spot',
        leverage: 10,
        take_profit_percentage: '',
        stop_loss_percentage: '',
        market_regime_filter_enabled: false,
        optimus_enabled: false,
        sizing_strategy: 'fixed_amount',
        strategy_params: {},
        sizing_params: {}
    });

    // Effect to update exchange and symbol when asset class changes
    useEffect(() => {
        const newConfig = BROKER_CONFIG[botData.asset_class];
        setBotData(prev => ({
            ...prev,
            exchange: newConfig.brokers[0],
            symbol: newConfig.symbols[0],
        }));
    }, [botData.asset_class]);

    // Effect to update default strategy params when strategy changes
    useEffect(() => {
        const params = {};
        (STRATEGY_CONFIG[botData.strategy_name] || []).forEach(p => { params[p.name] = p.default; });
        setBotData(prev => ({ ...prev, strategy_params: params }));
    }, [botData.strategy_name]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const keys = name.split('.');
        if (keys.length === 2) {
            setBotData(prev => ({...prev, [keys[0]]: { ...prev[keys[0]], [keys[1]]: type === 'number' ? parseFloat(value) || '' : value }}));
        } else {
            setBotData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            ...botData,
            strategy_type: 'prebuilt', // TV Alert is handled like a prebuilt strategy
            leverage: parseInt(botData.leverage, 10),
            take_profit_percentage: botData.take_profit_percentage ? parseFloat(botData.take_profit_percentage) : null,
            stop_loss_percentage: botData.stop_loss_percentage ? parseFloat(botData.stop_loss_percentage) : null,
        };
        if (payload.market_type === 'spot') delete payload.leverage;
        onSubmit(payload);
    };

    const config = BROKER_CONFIG[botData.asset_class];

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <Input label="Bot Name" name="name" placeholder="e.g., My EUR/USD Scalper" value={botData.name} onChange={handleInputChange} required />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">Asset Class</label>
                    <select name="asset_class" value={botData.asset_class} onChange={handleInputChange} className="w-full p-2 bg-light-secondary dark:bg-primary border border-light-border dark:border-border-color rounded-md">
                        <option value="crypto">Crypto</option>
                        <option value="forex">Forex</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">Broker/Exchange</label>
                    <select name="exchange" value={botData.exchange} onChange={handleInputChange} className="w-full p-2 bg-light-secondary dark:bg-primary border border-light-border dark:border-border-color rounded-md">
                        {config.brokers.map(name => <option key={name} value={name}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">Symbol</label>
                    {/* --- UX IMPROVEMENT: Changed to a scrollable listbox for long lists --- */}
                    <select
                        name="symbol"
                        value={botData.symbol}
                        onChange={handleInputChange}
                        size="6"
                        className="w-full p-2 bg-light-secondary dark:bg-primary border border-light-border dark:border-border-color rounded-md"
                    >
                        {config.symbols.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">Strategy</label>
                <select name="strategy_name" value={botData.strategy_name} onChange={handleInputChange} className="w-full p-2 bg-light-secondary dark:bg-primary border border-light-border dark:border-border-color rounded-md">
                    {Object.keys(STRATEGY_CONFIG).map(name => <option key={name} value={name}>{name.replace(/_/g, ' ')}</option>)}
                </select>
            </div>

            {botData.strategy_name !== 'TradingView_Alert' && (
                <div className="border-t border-light-border dark:border-border-color pt-4">
                    <h4 className="font-semibold text-light-heading dark:text-white mb-2">Strategy Parameters</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {(STRATEGY_CONFIG[botData.strategy_name] || []).map(param => (
                            <Input key={param.name} label={param.label} name={`strategy_params.${param.name}`} type={param.type} value={botData.strategy_params[param.name] || ''} onChange={handleInputChange} step="any"/>
                        ))}
                    </div>
                </div>
            )}

            {botData.strategy_name === 'TradingView_Alert' && (
                <div className="p-4 bg-primary rounded-lg border border-accent text-center">
                    <p className="text-light-gray">This bot is triggered by TradingView alerts. After creating the bot, you will receive a unique webhook URL to use in your TradingView alert settings.</p>
                </div>
            )}

            <div className="border-t border-light-border dark:border-border-color pt-4">
                <h4 className="font-semibold text-light-heading dark:text-white mb-2">Market & Leverage (Ultimate Plan)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">Market Type</label>
                        <select name="market_type" value={botData.market_type} onChange={handleInputChange} disabled={!isUltimate} className="w-full p-2 bg-light-secondary dark:bg-primary border border-light-border dark:border-border-color rounded-md disabled:opacity-50">
                            <option value="spot">Spot</option>
                            <option value="future">Futures</option>
                        </select>
                    </div>
                    {botData.market_type === 'future' && isUltimate && (
                        <div>
                            <label className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">Leverage ({botData.leverage}x)</label>
                            <input name="leverage" type="range" min="1" max="100" step="1" value={botData.leverage} onChange={handleInputChange} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"/>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-light-border dark:border-border-color pt-4">
                <h4 className="font-semibold text-light-heading dark:text-white mb-2">Risk Management</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Take Profit (%)" name="take_profit_percentage" type="number" step="0.1" placeholder="Optional, e.g., 5" value={botData.take_profit_percentage} onChange={handleInputChange} />
                    <Input label="Stop Loss (%)" name="stop_loss_percentage" type="number" step="0.1" placeholder="Optional, e.g., 2" value={botData.stop_loss_percentage} onChange={handleInputChange} />
                </div>
            </div>

            <div className="border-t border-light-border dark:border-border-color pt-4 space-y-3">
                <h4 className="font-semibold text-light-heading dark:text-white">Advanced Options</h4>
                <CheckboxWithTooltip id="paper_trading" name="is_paper_trading" checked={botData.is_paper_trading} onChange={handleInputChange} label="Enable Paper Trading" tooltip="Simulate trades with fake money to test your strategy risk-free."/>
                <CheckboxWithTooltip id="market_regime_filter" name="market_regime_filter_enabled" checked={botData.market_regime_filter_enabled} onChange={handleInputChange} disabled={!isPremiumOrHigher} label="Market Regime Filter" tooltip={isPremiumOrHigher ? "Only enter long positions when the broader market trend is bullish." : "Upgrade to Premium to unlock."}/>
                <CheckboxWithTooltip id="optimus_enabled" name="optimus_enabled" checked={botData.optimus_enabled} onChange={handleInputChange} disabled={!isUltimate} label="Enable Optimus AI Mode" tooltip={isUltimate ? "The AI will veto buy signals if broader market conditions are unfavorable." : "Upgrade to Ultimate to unlock."}/>
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full !mt-6">
                Create Bot
            </Button>
        </form>
    );
};

export default CreateBotForm;