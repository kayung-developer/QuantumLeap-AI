// src/pages/StrategyLabPage.js

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// API and Hooks
import { useAuth } from '../contexts/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import { runSingleBacktest, startOptimization, getOptimizationStatus, createBot } from '../api/apiService';
import { useWebSocket } from '../contexts/WebSocketContext';

// UI Components
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';
import StrategySensei from '../components/strategylab/StrategySensei';
import OptimizationResultsTable from '../components/strategylab/OptimizationResultsTable';
import { FaFlask, FaCog, FaSync, FaRocket, FaPlus } from 'react-icons/fa';

// --- Strategy Configuration ---
const STRATEGY_PARAMETERS = {
    "MA_Cross": [
        { name: 'short_window', label: 'Short MA', type: 'range', default: [10, 50, 5], singleDefault: 20 },
        { name: 'long_window', label: 'Long MA', type: 'range', default: [50, 200, 25], singleDefault: 100 },
    ],
    "RSI_MACD_Crossover": [
        { name: 'rsi_period', label: 'RSI Period', type: 'range', default: [10, 20, 2], singleDefault: 14 },
        { name: 'macd_fast', label: 'MACD Fast', type: 'range', default: [8, 16, 2], singleDefault: 12 },
        { name: 'macd_slow', label: 'MACD Slow', type: 'range', default: [20, 30, 2], singleDefault: 26 },
    ],
    "Bollinger_Bands": [
        { name: 'window', label: 'BB Window', type: 'range', default: [15, 25, 5], singleDefault: 20 },
        { name: 'std_dev', label: 'Std. Dev.', type: 'range', default: [2.0, 3.0, 0.5], singleDefault: 2.0 },
    ],
    "Smart_Money_Concepts": [
        { name: 'risk_reward_ratio', label: 'Risk/Reward Ratio', type: 'range', default: [1.5, 5.0, 0.5], singleDefault: 2.0 },
    ],
    "Volatility_Squeeze": [
        { name: 'bb_period', label: 'BB Period', type: 'range', default: [15, 25, 5], singleDefault: 20 },
        { name: 'kc_period', label: 'KC Period', type: 'range', default: [15, 25, 5], singleDefault: 20 },
    ],
    "SuperTrend_ADX_Filter": [
        { name: 'st_period', label: 'ST Period', type: 'range', default: [7, 14, 1], singleDefault: 10 },
        { name: 'st_multiplier', label: 'ST Multiplier', type: 'range', default: [2.0, 4.0, 0.5], singleDefault: 3.0 },
        { name: 'adx_threshold', label: 'ADX Strength', type: 'range', default: [20, 30, 5], singleDefault: 25 },
    ],
    "Ichimoku_Cloud_Breakout": [],
    "AI_Signal_Confirmation": [
        { name: 'confidence_threshold', label: 'AI Confidence', type: 'range', default: [0.1, 0.5, 0.1], singleDefault: 0.2 },
    ],
    "Optimizer_Portfolio": [],
    "TradingView_Alert": [], 
};

// Helper to generate range
const generateRange = (start, end, step) => {
    const arr = [];
    if (step <= 0) step = 1; 
    for (let i = start; i <= end; i = i + step) {
        arr.push(parseFloat(i.toFixed(2)));
    }
    return arr;
};

const StrategyLabPage = () => {
    const { profile } = useAuth();
    const { messages } = useWebSocket() || { messages: [] };

    const [config, setConfig] = useState({
        symbol: 'BTC/USDT',
        exchange: 'binance',
        start_date: '2023-01-01',
        end_date: new Date().toISOString().split('T')[0],
        strategy_name: 'MA_Cross',
        params: {},
    });

    const [mode, setMode] = useState('backtest');
    const [backtestResult, setBacktestResult] = useState(null);
    const [optimizationTask, setOptimizationTask] = useState(null); 
    
    // Polling Interval Ref
    const pollInterval = useRef(null);

    // Initialize params
    useEffect(() => {
        const paramsConfig = STRATEGY_PARAMETERS[config.strategy_name];
        if (!paramsConfig) {
            setConfig(prev => ({ ...prev, params: {} }));
            return;
        };
        const initialParams = {};
        paramsConfig.forEach(p => {
            if (p.type === 'range') {
                initialParams[p.name] = { from: p.default[0], to: p.default[1], step: p.default[2] };
            }
        });
        setConfig(prev => ({ ...prev, params: initialParams }));
    }, [config.strategy_name]);

    // --- CLEANUP ---
    useEffect(() => {
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, []);

    const singleBacktestMutation = useApiMutation(runSingleBacktest, {
        onSuccess: (data) => {
            const resultForTable = { metrics: data.data, params: data.data.params };
            setBacktestResult(resultForTable);
            setOptimizationTask({
                id: data.data.task_id,
                status: 'PENDING',
                progress: 0,
                results: null,
                error: null,
            });
            toast.success("Backtest started. Waiting for results...");
        },
    });

    const optimizeMutation = useApiMutation(startOptimization, {
        onSuccess: (data) => {
            setBacktestResult(null);
            const newTaskId = data.data.task_id;
            
            setOptimizationTask({
                id: newTaskId,
                status: 'PENDING',
                progress: 0,
                results: null,
                error: null,
            });
            toast.success('Optimization task has started!');

            // --- START FORCED POLLING ---
            if (pollInterval.current) clearInterval(pollInterval.current);
            
            pollInterval.current = setInterval(async () => {
                try {
                    console.log("Polling task status:", newTaskId);
                    const response = await getOptimizationStatus(newTaskId);
                    const taskData = response.data;

                    if (taskData.status === 'COMPLETED' || taskData.status === 'FAILED') {
                        clearInterval(pollInterval.current); // Stop polling
                        
                        setOptimizationTask(prev => ({
                            ...prev,
                            status: taskData.status,
                            results: taskData.results,
                            error: taskData.error,
                            progress: 1.0
                        }));

                        // Reset mutation loading state manually
                        optimizeMutation.reset();

                        if (taskData.status === 'COMPLETED') {
                            toast.success("Optimization Results Ready!");
                        } else {
                            toast.error("Optimization Failed.");
                        }
                    } else {
                        // Still running
                        setOptimizationTask(prev => ({
                            ...prev,
                            status: taskData.status,
                            progress: taskData.progress
                        }));
                    }
                } catch (err) {
                    console.error("Polling error:", err);
                    // Don't stop polling on single network error, wait for next tick
                }
            }, 2000); // Check every 2 seconds
        },
    });

    // --- WEBSOCKET LISTENER (Optional Speedup) ---
    // If WS comes first, it updates state, but polling ensures 100% delivery.
    useEffect(() => {
        if (!optimizationTask?.id) return;

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (msg.task_id === optimizationTask.id) {
                if (msg.type === 'optimization_progress') {
                    setOptimizationTask(prev => ({ ...prev, status: 'RUNNING', progress: msg.progress }));
                } 
                else if (msg.type === 'optimization_complete') {
                    // If WS tells us it's done, stop polling immediately
                    if (pollInterval.current) clearInterval(pollInterval.current);
                    
                    setOptimizationTask(prev => ({
                        ...prev,
                        status: msg.status,
                        results: msg.results,
                        error: msg.error,
                        progress: 1.0,
                    }));
                    optimizeMutation.reset();
                    break; 
                }
            }
        }
    }, [messages, optimizationTask?.id]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'exchange') {
            const newSymbol = value === 'mt5' ? 'EURUSD' : 'BTC/USDT';
            setConfig(prev => ({ ...prev, exchange: value, symbol: newSymbol }));
        } else {
            setConfig(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleParamChange = (e, paramName) => {
        const { name, value } = e.target;
        setConfig(prev => ({
            ...prev,
            params: { ...prev.params, [paramName]: { ...prev.params[paramName], [name]: parseFloat(value) } }
        }));
    };

    const handleRunAction = (e) => {
        e.preventDefault();
        setBacktestResult(null);
        setOptimizationTask(null);
        if (pollInterval.current) clearInterval(pollInterval.current);
        let payload = {};
        if (mode === 'backtest') {
            const paramsConfig = STRATEGY_PARAMETERS[config.strategy_name] || [];
            const singleParams = {};
            paramsConfig.forEach(p => {
                if (p.singleDefault !== undefined) {
                    singleParams[p.name] = p.singleDefault;
                }
            });

            payload = {
                strategy_name: config.strategy_name,
                symbol: config.symbol,
                exchange: config.exchange,
                start_date: config.start_date,
                end_date: config.end_date,
                params: singleParams
            };
            singleBacktestMutation.mutate(payload);

        } else { 
            const parameter_ranges = {};
            for (const key in config.params) {
                const { from, to, step } = config.params[key];
                if (from !== undefined && to !== undefined && step !== undefined) {
                    parameter_ranges[key] = generateRange(from, to, step);
                }
            }
            payload = {
                strategy_name: config.strategy_name,
                symbol: config.symbol,
                exchange: config.exchange,
                start_date: config.start_date,
                end_date: config.end_date,
                parameter_ranges: parameter_ranges
            };
            optimizeMutation.mutate(payload);
        }
    };

    const handleStrategySuggestion = (suggestion) => {
        if (suggestion.error) return toast.error(`Sensei says: ${suggestion.error}`);
        toast.success(`Sensei suggests: ${suggestion.explanation}`);
        setConfig(prev => ({ ...prev, strategy_name: suggestion.strategy_name }));
    };

    const hasSenseiAccess = profile?.subscription_plan === 'premium' || profile?.subscription_plan === 'ultimate';
    
    // Check loading state
    const isRunning = singleBacktestMutation.isLoading || 
                      optimizeMutation.isLoading || 
                      (optimizationTask && optimizationTask.status !== 'COMPLETED' && optimizationTask.status !== 'FAILED');

    const error = singleBacktestMutation.error || optimizeMutation.error || optimizationTask?.error;
    
    let tableResults = null;
    if (optimizationTask?.status === 'COMPLETED' && optimizationTask.results) {
        if (Array.isArray(optimizationTask.results)) {
            // Optimization returns an array
            tableResults = optimizationTask.results;
        } else {
            // Single Backtest returns a single object { metrics: {...}, params: {...} }
            // We wrap it in an array to make the table happy
            // Note: The backend might return just the metrics dict for single backtest task results.
            // Let's assume the Task Result for single backtest matches the OptimizationResult schema.
            // If it returns raw metrics, we adapt:
            const raw = optimizationTask.results;
            if (raw.metrics && raw.params) {
                tableResults = [raw]; 
            } else {
                // Fallback if backend structure differs slightly for single run
                tableResults = [{ metrics: raw, params: config.params }]; 
            }
        }
    }
    
    const navigate = useNavigate(); // Initialize hook

    // --- NEW: Create Bot Mutation ---
    const createBotMutation = useApiMutation(createBot, {
        successMessage: 'Bot created from best result!',
        invalidateQueries: ['userBots'],
        onSuccess: () => {
            navigate('/dashboard/bots');
        }
    });

    // --- NEW: Handler for the button ---
    const handleCreateFromBest = () => {
        if (!optimizationTask?.results || optimizationTask.results.length === 0) {
            toast.error("No results available to create a bot.");
            return;
        }

        // The results are usually sorted by the backend (highest Sharpe/Return first). 
        // We take the first one (index 0).
        const bestResult = optimizationTask.results[0];

        // Determine asset class based on exchange
        const assetClass = config.exchange === 'mt5' ? 'forex' : 'crypto';

        const botPayload = {
            name: `Optimized ${config.strategy_name} - ${new Date().toLocaleDateString()}`,
            symbol: config.symbol,
            exchange: config.exchange,
            // Auto-detect asset class based on exchange
            asset_class: ['mt4', 'mt5'].includes(config.exchange) ? 'forex' : 'crypto',
            strategy_type: 'prebuilt',
            strategy_name: config.strategy_name,
            // Pass the optimized parameters object directly
            strategy_params: bestResult.params,
            market_type: 'spot',
            is_paper_trading: false,
            // Explicitly set optional fields to valid defaults
            take_profit_percentage: null,
            stop_loss_percentage: null,
            leverage: 1,
            market_regime_filter_enabled: true,
            optimus_enabled: true
        };

        createBotMutation.mutate(botPayload);
    };

    return (
        <div className="space-y-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white flex items-center"><FaFlask className="mr-3 text-accent"/>Strategy Laboratory</h1>
                <p className="text-light-gray mt-1">Discover, optimize, and publish your trading strategies.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <form onSubmit={handleRunAction}>
                            {/* Header: Black in Light, White in Dark */}
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">1. General Configuration</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Input label="Symbol" name="symbol" value={config.symbol} onChange={handleInputChange} />
                                
                                {/* Exchange Dropdown */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-light-gray mb-1">Exchange</label>
                                    <select 
                                        name="exchange" 
                                        value={config.exchange} 
                                        onChange={handleInputChange} 
                                        className="w-full p-2 bg-white dark:bg-primary border border-gray-300 dark:border-border-color rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none transition-all"
                                    >
                                        <option value="binance">Binance</option>
                                        <option value="kucoin">KuCoin</option>
                                        <option value="bybit">Bybit</option>
                                        <option value="mt5">MetaTrader 5</option>
                                    </select>
                                </div>
                                
                                <Input label="Start Date" name="start_date" type="date" value={config.start_date} onChange={handleInputChange} />
                                <Input label="End Date" name="end_date" type="date" value={config.end_date} onChange={handleInputChange} />
                            </div>

                            <div className="border-t border-gray-200 dark:border-border-color my-6 pt-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">2. Choose Your Action</h2>
                                
                                {/* Toggle Buttons Container */}
                                <div className="flex items-center space-x-4 mb-6">
                                    <div className="flex rounded-lg bg-gray-100 dark:bg-primary p-1 border border-gray-200 dark:border-transparent">
                                        <button 
                                            type="button" 
                                            onClick={() => setMode('backtest')} 
                                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${mode === 'backtest' ? 'bg-white text-accent shadow-sm dark:bg-accent dark:text-white' : 'text-gray-600 hover:text-black dark:text-light-gray dark:hover:text-white'}`}
                                        >
                                            Quick Backtest
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setMode('optimize')} 
                                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${mode === 'optimize' ? 'bg-white text-accent shadow-sm dark:bg-accent dark:text-white' : 'text-gray-600 hover:text-black dark:text-light-gray dark:hover:text-white'}`}
                                        >
                                            Full Optimization
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="lg:col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-light-gray mb-1">Strategy</label>
                                        <select 
                                            name="strategy_name" 
                                            value={config.strategy_name} 
                                            onChange={handleInputChange} 
                                            className="w-full p-2 bg-white dark:bg-primary border border-gray-300 dark:border-border-color rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none transition-all"
                                        >
                                            {Object.keys(STRATEGY_PARAMETERS).map(s => (
                                                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Parameter Inputs */}
                                    {mode === 'optimize' && (STRATEGY_PARAMETERS[config.strategy_name] || []).filter(p => p.type === 'range').map(param => (
                                        <div key={param.name} className="bg-gray-50 dark:bg-secondary p-4 rounded-lg border border-gray-200 dark:border-border-color">
                                            <label className="text-sm font-bold text-gray-900 dark:text-white block mb-3">{param.label}</label>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <span className="text-xs font-bold text-gray-500 dark:text-light-gray mb-1 block uppercase">Start</span>
                                                    <Input name="from" type="number" step="any" value={config.params[param.name]?.from || ''} onChange={(e) => handleParamChange(e, param.name)} className="bg-white dark:bg-primary" />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-gray-500 dark:text-light-gray mb-1 block uppercase">End</span>
                                                    <Input name="to" type="number" step="any" value={config.params[param.name]?.to || ''} onChange={(e) => handleParamChange(e, param.name)} className="bg-white dark:bg-primary" />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-gray-500 dark:text-light-gray mb-1 block uppercase">Step</span>
                                                    <Input name="step" type="number" step="any" value={config.params[param.name]?.step || ''} onChange={(e) => handleParamChange(e, param.name)} className="bg-white dark:bg-primary" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-light-gray mt-4 font-medium">
                                    {mode === 'backtest' ? 'Runs a single backtest with default parameters.' : 'Runs many backtests to find the best parameters.'}
                                </p>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <Button type="submit" isLoading={isRunning} disabled={isRunning} className="w-full sm:w-auto">
                                    {mode === 'backtest' ? <><FaSync className="mr-2"/>Run Quick Backtest</> : <><FaCog className="mr-2"/>Run Full Optimization</>}
                                </Button>
                            </div>
                        </form>
                    </Card>

                    {/* --- PROGRESS DISPLAY --- */}
                    {isRunning && optimizationTask && (
                        <Card>
                            <div className="flex flex-col items-center p-8">
                                <Spinner size="lg"/><p className="text-white mt-4">Running optimization... please wait.</p>
                                <div className="w-full max-w-md mt-4">
                                    <div className="flex justify-between mb-1"><span className="text-base font-medium text-accent">Progress</span><span className="text-sm font-medium text-accent">{Math.round(optimizationTask.progress * 100)}%</span></div>
                                    <div className="w-full bg-primary rounded-full h-2.5"><div className="bg-accent h-2.5 rounded-full" style={{ width: `${optimizationTask.progress * 100}%` }}></div></div>
                                </div>
                            </div>
                        </Card>
                    )}
                    
                    {error && (
    <Alert 
        type="error" 
        message={(() => {
            // Safely extract the message to avoid "Objects are not valid as React child" crash
            const detail = error.response?.data?.detail;
            if (Array.isArray(detail)) {
                return detail.map(e => e.msg).join(', ');
            }
            return detail || error.message || String(error);
        })()} 
    />
)}

                    {/* --- RESULTS DISPLAY --- */}
                    {tableResults && (
                         <Card>
                            <h2 className="text-2xl font-bold text-white mb-4">Results</h2>
                            <OptimizationResultsTable results={tableResults} />

                            {optimizationTask?.status === 'COMPLETED' && (
                                <div className="mt-6 pt-6 border-t border-border-color text-center">
                                    <h3 className="text-lg font-semibold text-white">Found a Winner?</h3>
                                    <p className="text-sm text-light-gray my-2">Create a new bot using the best-performing parameters.</p>
                                    <Button 
                                        variant="success" 
                                        onClick={handleCreateFromBest} 
                                        isLoading={createBotMutation.isLoading}
                                    >
                                        <FaPlus className="mr-2" /> Create Bot from Best Result
                                    </Button>
                                </div>
                            )}
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-1">
                    {hasSenseiAccess ? (
                        <StrategySensei onStrategySuggested={handleStrategySuggestion} />
                    ) : (
                        <Card className="bg-gradient-to-r from-accent/10 to-transparent p-6 flex flex-col items-center text-center gap-4 h-full justify-center">
                            <FaRocket className="text-5xl text-accent" />
                            <h3 className="text-xl font-bold text-white">Unlock the Strategy Sensei</h3>
                            <p className="text-light-gray mt-1">Upgrade to Premium to get AI-powered strategy suggestions.</p>
                            <Link to="/dashboard/billing" className="mt-4"><Button>Upgrade Plan</Button></Link>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StrategyLabPage;