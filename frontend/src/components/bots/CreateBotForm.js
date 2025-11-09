// src/components/bots/CreateBotForm.js

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Input from '../common/Input';
import Button from '../common/Button';
import CheckboxWithTooltip from '../common/CheckboxWithTooltip';

// --- ROBUST CONFIGURATION OBJECTS ---
const BROKER_CONFIG = {
    crypto: {
        brokers: ['mt5', 'binance', 'kucoin', 'bybit'], // Updated list
        symbols: [
            'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
            'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'SHIB/USDT', 'DOT/USDT',
            'LINK/USDT', 'TRX/USDT', 'MATIC/USDT', 'LTC/USDT', 'ATOM/USDT',
            'NEAR/USDT', 'UNI/USDT', 'XLM/USDT', 'ICP/USDT', 'ETC/USDT'
        ]
    },
    forex: {
        brokers: ['mt5', 'binance', 'kucoin', 'bybit'], // Forex supported by major exchanges
        symbols: [
            'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD',
            'USD/CAD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY',
            'GBP/CHF', 'AUD/NZD', 'EUR/AUD', 'GBP/CAD', 'EUR/CAD', 'USD/MXN',
            'USD/ZAR', 'USD/INR'
        ]
    }
};

const STRATEGY_CONFIG = {
    "RSI_MACD_Crossover": [
        { name: "rsi_period", label: "RSI Period", default: 14, type: 'number' },
        { name: "rsi_oversold", label: "RSI Oversold", default: 30, type: 'number' },
        { name: "rsi_overbought", label: "RSI Overbought", default: 70, type: 'number' },
    ],
    "MA_Cross": [
        { name: "short_window", label: "Short MA", default: 50, type: 'number' },
        { name: "long_window", label: "Long MA", default: 200, type: 'number' },
    ],
    "Bollinger_Bands": [
        { name: "window", label: "Period", default: 20, type: 'number' },
        { name: "std_dev", label: "Std. Dev.", default: 2.0, type: 'number', step: 0.1 },
    ],
    "Smart_Money_Concepts": [
        { name: "risk_reward_ratio", label: "Risk/Reward Ratio", default: 2.0, type: 'number', step: 0.5 },
    ],
    "Grid_Trading": [
        { name: "upper_price", label: "Upper Price", type: 'number', step: 'any' },
        { name: "lower_price", label: "Lower Price", type: 'number', step: 'any' },
        { name: "num_grids", label: "# of Grids", default: 10, type: 'number' },
        { name: "trade_amount_base", label: "Amount per Grid", type: 'number', step: 'any' },
    ],
    "Volatility_Squeeze": [
        { name: "bb_period", label: "BB Period", default: 20, type: 'number' },
        { name: "kc_period", label: "KC Period", default: 20, type: 'number' },
    ],
    "SuperTrend_ADX_Filter": [
        { name: "st_period", label: "ST Period", default: 12, type: 'number' },
        { name: "st_multiplier", label: "ST Multiplier", default: 3.0, type: 'number', step: 0.1 },
        { name: "adx_threshold", label: "ADX Threshold", default: 25, type: 'number' },
    ],
    "Ichimoku_Cloud_Breakout": [],
    "AI_Signal_Confirmation": [
        { name: "confidence_threshold", label: "AI Confidence", default: 0.1, step: 0.1, type: 'number' },
    ],
    "Optimizer_Portfolio": [], // This strategy has a custom UI
    "TradingView_Alert": [],   // This strategy has no user-configurable params
};

const CreateBotForm = ({ onSubmit, isLoading }) => {
    const { profile } = useAuth();
    const isPremiumOrHigher = profile?.subscription_plan === 'premium' || profile?.subscription_plan === 'ultimate';
    const isUltimate = profile?.subscription_plan === 'ultimate';

    const [botData, setBotData] = React.useState({
        name: '',
        asset_class: 'forex',
        exchange: 'mt5',
        symbol: 'EURUSD',
        strategy_name: 'MA_Cross',
        is_paper_trading: false,
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
    React.useEffect(() => {
        const newConfig = BROKER_CONFIG[botData.asset_class];
        setBotData(prev => ({
            ...prev,
            exchange: newConfig.brokers[0],
            symbol: newConfig.symbols[0],
        }));
    }, [botData.asset_class]);

    // Effect to update default strategy params when strategy changes
    React.useEffect(() => {
        const params = {};
        const config = STRATEGY_CONFIG[botData.strategy_name] || [];
        config.forEach(p => {
            if (p.default !== undefined) {
                params[p.name] = p.default;
            }
        });

        // Special case for Optimizer Portfolio
        if (botData.strategy_name === 'Optimizer_Portfolio') {
            params.strategy_pool = ["RSI_MACD_Crossover", "MA_Cross"]; // Set a default pool
        }

        setBotData(prev => ({ ...prev, strategy_params: params }));
    }, [botData.strategy_name]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const keys = name.split('.');
        if (keys.length === 2) { // Handles nested state like `strategy_params.short_window`
            setBotData(prev => ({...prev, [keys[0]]: { ...prev[keys[0]], [keys[1]]: value }}));
        } else {
            setBotData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const handleOptimizerPoolChange = (strategyName) => {
        setBotData(prev => {
            const currentPool = prev.strategy_params.strategy_pool || [];
            const newPool = currentPool.includes(strategyName)
                ? currentPool.filter(s => s !== strategyName)
                : [...currentPool, strategyName];
            return { ...prev, strategy_params: { ...prev.strategy_params, strategy_pool: newPool } };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            ...botData,
            strategy_type: 'prebuilt',
            leverage: parseInt(botData.leverage, 10),
            take_profit_percentage: botData.take_profit_percentage ? parseFloat(botData.take_profit_percentage) : null,
            stop_loss_percentage: botData.stop_loss_percentage ? parseFloat(botData.stop_loss_percentage) : null,
        };
        if (payload.exchange === 'mt5' || payload.exchange === 'mt4') {
            payload.is_paper_trading = false;
        }
        if (payload.market_type === 'spot') delete payload.leverage;
        onSubmit(payload);
    };

    const config = BROKER_CONFIG[botData.asset_class];
    const isMTBot = botData.exchange === 'mt5' || botData.exchange === 'mt4';

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <Input label="Bot Name" name="name" placeholder="e.g., My EUR/USD Scalper" value={botData.name} onChange={handleInputChange} required />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-light-gray mb-1">Asset Class</label>
                    <select name="asset_class" value={botData.asset_class} onChange={handleInputChange} className="w-full p-2 bg-secondary border border-border-color rounded-md">
                        <option value="forex">Forex</option>
                        <option value="crypto">Crypto</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-light-gray mb-1">Broker/Exchange</label>
                    <select name="exchange" value={botData.exchange} onChange={handleInputChange} className="w-full p-2 bg-secondary border border-border-color rounded-md">
                        {config.brokers.map(name => <option key={name} value={name}>{name.toUpperCase()}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-light-gray mb-1">Symbol</label>
                <select name="symbol" value={botData.symbol} onChange={handleInputChange} className="w-full p-2 bg-secondary border border-border-color rounded-md">
                    {config.symbols.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-light-gray mb-1">Strategy</label>
                <select name="strategy_name" value={botData.strategy_name} onChange={handleInputChange} className="w-full p-2 bg-secondary border border-border-color rounded-md">
                    {Object.keys(STRATEGY_CONFIG).map(name => <option key={name} value={name}>{name.replace(/_/g, ' ')}</option>)}
                </select>
            </div>

            {botData.strategy_name !== 'TradingView_Alert' && (
                <div className="border-t border-border-color pt-4">
                    <h4 className="font-semibold text-white mb-2">Strategy Parameters</h4>

                    {botData.strategy_name === 'Optimizer_Portfolio' ? (
                        <div>
                            <label className="block text-sm font-medium text-light-gray mb-2">Select Strategies for Portfolio:</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.keys(STRATEGY_CONFIG)
                                    .filter(name => name !== 'Optimizer_Portfolio' && name !== 'TradingView_Alert' && name !== 'AI_Signal_Confirmation')
                                    .map(name => (
                                    <div key={name} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id={`opt-${name}`}
                                            checked={(botData.strategy_params.strategy_pool || []).includes(name)}
                                            onChange={() => handleOptimizerPoolChange(name)}
                                            className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                                        />
                                        <label htmlFor={`opt-${name}`} className="ml-2 block text-sm text-light-gray">{name.replace(/_/g, ' ')}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {(STRATEGY_CONFIG[botData.strategy_name] || []).map(param => (
                                <Input key={param.name} label={param.label} name={`strategy_params.${param.name}`} type={param.type || 'text'} value={botData.strategy_params[param.name] || ''} onChange={handleInputChange} step={param.step || "any"}/>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {botData.strategy_name === 'TradingView_Alert' && (
                <div className="p-4 bg-secondary rounded-lg border border-accent text-center">
                    <p className="text-light-gray">This bot is triggered by TradingView alerts. After creating the bot, you will receive a unique webhook URL to use in your alert settings.</p>
                </div>
            )}

            <div className="border-t border-border-color pt-4">
                <h4 className="font-semibold text-white mb-2">Market & Leverage (Ultimate Plan)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-light-gray mb-1">Market Type</label>
                        <select name="market_type" value={botData.market_type} onChange={handleInputChange} disabled={!isUltimate} className="w-full p-2 bg-secondary border border-border-color rounded-md disabled:opacity-50">
                            <option value="spot">Spot</option>
                            <option value="future">Futures</option>
                        </select>
                    </div>
                    {botData.market_type === 'future' && isUltimate && (
                        <div>
                            <label className="block text-sm font-medium text-light-gray mb-1">Leverage ({botData.leverage}x)</label>
                            <input name="leverage" type="range" min="1" max="100" step="1" value={botData.leverage} onChange={handleInputChange} className="w-full h-2 bg-gray-400 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"/>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-border-color pt-4">
                <h4 className="font-semibold text-white mb-2">Risk Management</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Take Profit (%)" name="take_profit_percentage" type="number" step="0.1" placeholder="Optional, e.g., 5" value={botData.take_profit_percentage} onChange={handleInputChange} />
                    <Input label="Stop Loss (%)" name="stop_loss_percentage" type="number" step="0.1" placeholder="Optional, e.g., 2" value={botData.stop_loss_percentage} onChange={handleInputChange} />
                </div>
            </div>

            <div className="border-t border-border-color pt-4 space-y-3">
                <h4 className="font-semibold text-white">Advanced Options</h4>
                <CheckboxWithTooltip id="paper_trading" name="is_paper_trading" checked={botData.is_paper_trading} onChange={handleInputChange} disabled={isMTBot} label="Enable Paper Trading" tooltip={isMTBot ? "Paper trading for MT5 is done by connecting a demo account." : "Simulate trades with fake money to test your strategy risk-free."}/>
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