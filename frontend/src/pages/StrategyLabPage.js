import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// API and Hooks
import { useAuth } from '../contexts/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import { runSingleBacktest, startOptimization } from '../api/apiService';
import { useWebSocket } from '../contexts/WebSocketContext';

// UI Components
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';
import StrategySensei from '../components/strategylab/StrategySensei';
import OptimizationResultsTable from '../components/strategylab/OptimizationResultsTable';
import ShareBotModal from '../components/bots/ShareBotModal';
import { FaFlask, FaCog, FaSync, FaRocket, FaPlus } from 'react-icons/fa';

// --- Complete, Production-Grade Strategy Configuration ---
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
    "Ichimoku_Cloud_Breakout": [], // No simple parameters to optimize
    "AI_Signal_Confirmation": [
        { name: 'confidence_threshold', label: 'AI Confidence', type: 'range', default: [0.1, 0.5, 0.1], singleDefault: 0.2 },
    ],
};

// Helper function to generate a numerical range for optimization
const generateRange = (start, end, step) => {
    const arr = [];
    if (step <= 0) step = 1; // Prevent infinite loops
    for (let i = start; i <= end; i = i + step) {
        arr.push(parseFloat(i.toFixed(2)));
    }
    return arr;
};

const StrategyLabPage = () => {
    const { profile } = useAuth();
    const { messages } = useWebSocket() || { messages: [] }; // Get live messages

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
    const [optimizationTask, setOptimizationTask] = useState(null); // Tracks the current optimization job

    // Effect to initialize default parameters when the strategy name changes
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

    const singleBacktestMutation = useApiMutation(runSingleBacktest, {
        onSuccess: (data) => {
            const resultForTable = { metrics: data.data, params: data.data.params };
            setBacktestResult(resultForTable);
            setOptimizationTask(null);
            toast.success("Quick Backtest completed!");
        },
    });

    const optimizeMutation = useApiMutation(startOptimization, {
        onSuccess: (data) => {
            setBacktestResult(null);
            setOptimizationTask({
                id: data.data.task_id,
                status: 'PENDING',
                progress: 0,
                results: null,
                error: null,
            });
            toast.success('Optimization task has started!');
        },
    });

    // --- REAL-TIME WEBSOCKET LISTENER FOR OPTIMIZATION PROGRESS ---
    useEffect(() => {
        const latestMessage = messages?.[0];
        if (!latestMessage || !optimizationTask || !optimizationTask.id) return;

        if (latestMessage.type === 'optimization_progress' && latestMessage.task_id === optimizationTask.id) {
            setOptimizationTask(prev => ({ ...prev, status: 'RUNNING', progress: latestMessage.progress }));
        }

        if (latestMessage.type === 'optimization_complete' && latestMessage.task_id === optimizationTask.id) {
            setOptimizationTask(prev => ({
                ...prev,
                status: latestMessage.status,
                results: latestMessage.results,
                error: latestMessage.error,
                progress: 1.0,
            }));
            if (latestMessage.status === 'COMPLETED') {
                toast.success("Optimization finished!");
            } else {
                toast.error(`Optimization failed: ${latestMessage.error || "Unknown error"}`);
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

        if (mode === 'backtest') {
            const paramsConfig = STRATEGY_PARAMETERS[config.strategy_name] || [];
            const singleParams = {};
            paramsConfig.forEach(p => {
                if (p.singleDefault !== undefined) {
                    singleParams[p.name] = p.singleDefault;
                }
            });

            const payload = {
                strategy_name: config.strategy_name,
                symbol: config.symbol,
                exchange: config.exchange,
                start_date: config.start_date,
                end_date: config.end_date,
                params: singleParams
            };
            singleBacktestMutation.mutate(payload);

        } else { // mode === 'optimize'
            const parameter_ranges = {};
            for (const key in config.params) {
                const { from, to, step } = config.params[key];
                if (from !== undefined && to !== undefined && step !== undefined) {
                    parameter_ranges[key] = generateRange(from, to, step);
                }
            }
            const payload = {
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
    const isRunning = singleBacktestMutation.isLoading || optimizeMutation.isLoading || optimizationTask?.status === 'RUNNING' || optimizationTask?.status === 'PENDING';
    const error = singleBacktestMutation.error || optimizeMutation.error || optimizationTask?.error;
    const optimizationResults = optimizationTask?.status === 'COMPLETED' ? optimizationTask.results : null;

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
                            <h2 className="text-2xl font-bold text-white mb-4">1. General Configuration</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Input label="Symbol" name="symbol" value={config.symbol} onChange={handleInputChange} />
                                <div>
                                    <label className="block text-sm font-medium text-light-gray mb-1">Exchange</label>
                                    <select name="exchange" value={config.exchange} onChange={handleInputChange} className="w-full p-2 bg-primary border border-border-color rounded-md">
                                        <option value="binance">Binance</option>
                                        <option value="kucoin">KuCoin</option>
                                        <option value="bybit">Bybit</option>
                                        <option value="mt5">MetaTrader 5</option>
                                    </select>
                                </div>
                                <Input label="Start Date" name="start_date" type="date" value={config.start_date} onChange={handleInputChange} />
                                <Input label="End Date" name="end_date" type="date" value={config.end_date} onChange={handleInputChange} />
                            </div>

                            <div className="border-t border-border-color my-6 pt-6">
                                <h2 className="text-2xl font-bold text-white mb-4">2. Choose Your Action</h2>
                                <div className="flex items-center space-x-4 mb-4">
                                    <div className="flex rounded-lg bg-primary p-1">
                                        <button type="button" onClick={() => setMode('backtest')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'backtest' ? 'bg-accent text-white' : 'text-light-gray hover:bg-secondary'}`}>Quick Backtest</button>
                                        <button type="button" onClick={() => setMode('optimize')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'optimize' ? 'bg-accent text-white' : 'text-light-gray hover:bg-secondary'}`}>Full Optimization</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
                                    <div className="lg:col-span-2">
                                        <label className="block text-sm font-medium text-light-gray mb-1">Strategy</label>
                                        <select name="strategy_name" value={config.strategy_name} onChange={handleInputChange} className="w-full p-2 bg-primary border border-border-color rounded-md">
                                            {Object.keys(STRATEGY_PARAMETERS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                        </select>
                                    </div>

                                    {mode === 'optimize' && (STRATEGY_PARAMETERS[config.strategy_name] || []).filter(p => p.type === 'range').map(param => (
                                        <div key={param.name}>
                                            <label className="text-sm text-light-gray block mb-1">{param.label}</label>
                                            <div className="flex gap-2">
                                                <Input name="from" type="number" step="any" value={config.params[param.name]?.from || ''} onChange={(e) => handleParamChange(e, param.name)} placeholder="From"/>
                                                <Input name="to" type="number" step="any" value={config.params[param.name]?.to || ''} onChange={(e) => handleParamChange(e, param.name)} placeholder="To"/>
                                                <Input name="step" type="number" step="any" value={config.params[param.name]?.step || ''} onChange={(e) => handleParamChange(e, param.name)} placeholder="Step"/>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm text-light-gray mt-4">{mode === 'backtest' ? 'Runs a single backtest with default parameters to see baseline performance.' : 'Runs hundreds of backtests to find the best parameter combination for your selected strategy.'}</p>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <Button type="submit" isLoading={isRunning} disabled={isRunning} className="w-full sm:w-auto">
                                    {mode === 'backtest' ? <><FaSync className="mr-2"/>Run Quick Backtest</> : <><FaCog className="mr-2"/>Run Full Optimization</>}
                                </Button>
                            </div>
                        </form>
                    </Card>

                    {isRunning && (
                        <Card>
                            <div className="flex flex-col items-center p-8">
                                <Spinner size="lg"/><p className="text-white mt-4">Running analysis... this may take several minutes.</p>
                                {optimizationTask?.status === 'RUNNING' && (
                                    <div className="w-full max-w-md mt-4">
                                        <div className="flex justify-between mb-1"><span className="text-base font-medium text-accent">Optimizing</span><span className="text-sm font-medium text-accent">{Math.round(optimizationTask.progress * 100)}%</span></div>
                                        <div className="w-full bg-primary rounded-full h-2.5"><div className="bg-accent h-2.5 rounded-full" style={{ width: `${optimizationTask.progress * 100}%` }}></div></div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                    {error && <Alert type="error" message={error.response?.data?.detail || error.message || error} />}

                    {(backtestResult || optimizationResults) && (
                         <Card>
                            <h2 className="text-2xl font-bold text-white mb-4">Results</h2>
                            {backtestResult && <OptimizationResultsTable results={[backtestResult]} />}
                            {optimizationResults && <OptimizationResultsTable results={optimizationResults} />}

                            {optimizationResults && (
                                <div className="mt-6 pt-6 border-t border-border-color text-center">
                                    <h3 className="text-lg font-semibold text-white">Found a Winner?</h3>
                                    <p className="text-sm text-light-gray my-2">Create a new bot using the best-performing parameters from this optimization.</p>
                                    <Button variant="success">
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
                            <p className="text-light-gray mt-1">Upgrade to Premium to get AI-powered strategy suggestions and build strategies with natural language.</p>
                            <Link to="/dashboard/billing" className="mt-4"><Button>Upgrade Plan</Button></Link>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StrategyLabPage;