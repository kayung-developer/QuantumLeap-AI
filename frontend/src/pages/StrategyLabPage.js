// src/pages/StrategyLabPage.js

import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { compareStrategies, startOptimization, getOptimizationStatus, interpretStrategy } from '../api/apiService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';
import OptimizationResultsTable from '../components/strategylab/OptimizationResultsTable';
import StrategySensei from '../components/strategylab/StrategySensei';
import { FaFlask, FaCog, FaSync, FaLock, FaRocket } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext'; // 1. Import useAuth
import { Link } from 'react-router-dom';

const STRATEGY_PARAMETERS = {
  MA_Cross: [
    { name: 'short_window', label: 'Short MA Window', type: 'range', default: [10, 30, 5] },
    { name: 'long_window', label: 'Long MA Window', type: 'range', default: [50, 200, 50] },
  ],
  Bollinger_Bands: [
    { name: 'window', label: 'BB Window', type: 'range', default: [15, 25, 5] },
    { name: 'std_dev', label: 'Std. Dev.', type: 'range', default: [2.0, 3.0, 0.5] },
  ],
  Smart_Money_Concepts: [
    { name: 'risk_reward_ratio', label: 'Risk/Reward Ratio', type: 'range', default: [1.5, 3.0, 0.5] },
  ],
  RSI_MACD_Crossover: [
      { name: 'rsi_period', label: 'RSI Period', default: 14, type: 'number' },
      { name: 'macd_fast', label: 'MACD Fast', default: 12, type: 'number' },
      { name: 'macd_slow', label: 'MACD Slow', default: 26, type: 'number' },
  ],
};

const generateRange = (start, end, step) => {
    const arr = [];
    for (let i = start; i <= end; i = i + step) { arr.push(parseFloat(i.toFixed(2))); }
    return arr;
};

const StrategyLabPage = () => {
    const { profile } = useAuth();
    const [config, setConfig] = useState({
        symbol: 'BTC/USDT',
        exchange: 'binance',
        start_date: '2023-01-01',
        end_date: new Date().toISOString().split('T')[0], // Default to today
        strategy_name: 'MA_Cross',
        params: {},
    });
    const [taskId, setTaskId] = useState(null);
    const [taskStatus, setTaskStatus] = useState(null);
    const [results, setResults] = useState(null);

    // Effect to initialize/update params when strategy_name changes
    useEffect(() => {
        const paramsConfig = STRATEGY_PARAMETERS[config.strategy_name];
        if (!paramsConfig) return;
        const initialParams = {};
        paramsConfig.forEach(p => {
            if (p.type === 'range') {
                initialParams[p.name] = { from: p.default[0], to: p.default[1], step: p.default[2] };
            }
        });
        setConfig(prev => ({ ...prev, params: initialParams }));
    }, [config.strategy_name]);

    const compareMutation = useMutation({
        mutationFn: compareStrategies,
        onSuccess: (data) => setResults(data.data.map(res => ({ params: res.params, metrics: res, strategy: res.strategy }))),
    });

    const optimizeMutation = useMutation({
        mutationFn: startOptimization,
        onSuccess: (data) => {
            setTaskId(data.data.task_id);
            setTaskStatus({ status: 'PENDING', progress: 0 });
            setResults(null);
            toast.success('Optimization task started!');
        },
    });

    // Polling for optimization status
    useEffect(() => {
        if (!taskId || ['COMPLETED', 'FAILED'].includes(taskStatus?.status)) return;
        const interval = setInterval(async () => {
            try {
                const response = await getOptimizationStatus(taskId);
                setTaskStatus(response.data);
                if (['COMPLETED', 'FAILED'].includes(response.data.status)) {
                    if (response.data.status === 'COMPLETED') setResults(response.data.results);
                    clearInterval(interval);
                }
            } catch (error) {
                console.error("Failed to get optimization status:", error);
                setTaskStatus({ status: 'FAILED', error: 'Could not retrieve status.' });
                clearInterval(interval);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [taskId, taskStatus?.status]);

    const handleInputChange = (e) => setConfig(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleParamChange = (e, paramName) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, params: { ...prev.params, [paramName]: { ...prev.params[paramName], [name]: parseFloat(value) }}}));
    };

    const handleRunComparison = (e) => {
        e.preventDefault();
        setResults(null); setTaskId(null); setTaskStatus(null);
        compareMutation.mutate({ symbol: config.symbol, exchange: config.exchange, start_date: config.start_date, end_date: config.end_date });
    };

    const handleRunOptimization = (e) => {
        e.preventDefault();
        setResults(null); setTaskId(null); setTaskStatus(null);
        const parameter_ranges = {};
        for (const key in config.params) {
            const { from, to, step } = config.params[key];
            if (from !== undefined && to !== undefined && step !== undefined) {
                parameter_ranges[key] = generateRange(from, to, step);
            }
        }
        optimizeMutation.mutate({ ...config, parameter_ranges });
    };

    const handleStrategySuggestion = (suggestion) => {
        if (suggestion.error) return toast.error(`Sensei says: ${suggestion.error}`);
        toast.success(`Sensei suggests: ${suggestion.explanation}`);
        setConfig(prev => ({ ...prev, strategy_name: suggestion.strategy_name }));
    };
     const hasSenseiAccess = profile?.subscription_plan === 'premium' || profile?.subscription_plan === 'ultimate' || profile?.role === 'superuser';
    const isRunning = compareMutation.isLoading || optimizeMutation.isLoading || ['PENDING', 'RUNNING'].includes(taskStatus?.status);
    const error = compareMutation.error || optimizeMutation.error || (taskStatus && taskStatus.error);

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-light-heading dark:text-white flex items-center"><FaFlask className="mr-3 text-accent"/>Strategy Lab</h1>
                <p className="text-light-muted dark:text-light-gray mt-1">Discover the optimal parameters for your trading strategies.</p>
            </div>
            <div className="mb-8">
            {hasSenseiAccess ? (
                    <StrategySensei onStrategySuggested={handleStrategySuggestion} />
                ) : (
                    <Card className="bg-gradient-to-r from-accent/10 to-transparent p-6 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-shrink-0 text-5xl text-accent">
                            <FaRocket />
                        </div>
                        <div className="text-center md:text-left">
                            <h3 className="text-xl font-bold text-light-heading dark:text-white">Unlock the Strategy Sensei</h3>
                            <p className="text-light-muted dark:text-light-gray mt-1">
                                Upgrade to a Premium or Ultimate plan to get AI-powered strategy suggestions in plain English.
                            </p>
                        </div>
                        <div className="md:ml-auto flex-shrink-0">
                            <Link to="/dashboard/billing">
                                <Button>Upgrade Plan</Button>
                            </Link>
                        </div>
                    </Card>
                )}

            </div>

            <Card className="mb-6">
                <h2 className="text-2xl font-bold text-light-heading dark:text-white mb-4">Backtest Configuration</h2>
                <form>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input label="Symbol" name="symbol" value={config.symbol} onChange={handleInputChange} />
                        <Input label="Start Date" name="start_date" type="date" value={config.start_date} onChange={handleInputChange} />
                        <Input label="End Date" name="end_date" type="date" value={config.end_date} onChange={handleInputChange} />
                        <Input label="Exchange" name="exchange" value={config.exchange} onChange={handleInputChange} disabled />
                    </div>
                    <div className="border-t border-light-border dark:border-border-color my-6 pt-6">
                        <h3 className="text-xl font-semibold text-light-heading dark:text-white mb-4">Optimize Strategy Parameters</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
                            <div className="lg:col-span-2">
                                <label className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">Strategy</label>
                                <select name="strategy_name" value={config.strategy_name} onChange={handleInputChange} className="w-full p-2 bg-light-primary dark:bg-primary border border-light-border dark:border-border-color rounded-md">
                                    {Object.keys(STRATEGY_PARAMETERS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                </select>
                            </div>
                            {(STRATEGY_PARAMETERS[config.strategy_name] || []).filter(p => p.type === 'range').map(param => (
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
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 mt-6">
                        <Button type="button" onClick={handleRunOptimization} isLoading={isRunning && !!taskId} disabled={isRunning} className="w-full sm:w-auto"><FaCog className="mr-2"/>Run Optimization</Button>
                        <Button type="button" onClick={handleRunComparison} isLoading={isRunning && !taskId} disabled={isRunning} variant="secondary" className="w-full sm:w-auto"><FaSync className="mr-2"/>Quick Compare Strategies</Button>
                    </div>
                </form>
            </Card>

            {isRunning && (
                <Card><div className="flex flex-col items-center p-8"><Spinner size="lg"/><p className="text-light-text dark:text-white mt-4">Running analysis... this may take several minutes.</p>{taskStatus?.status === 'RUNNING' && (<div className="w-full max-w-md mt-4"><div className="flex justify-between mb-1"><span className="text-base font-medium text-accent">Optimizing</span><span className="text-sm font-medium text-accent">{Math.round(taskStatus.progress * 100)}%</span></div><div className="w-full bg-gray-200 dark:bg-primary rounded-full h-2.5"><div className="bg-accent h-2.5 rounded-full" style={{ width: `${taskStatus.progress * 100}%` }}></div></div></div>)}</div></Card>
            )}
            {error && <Alert type="error" message={error.response?.data?.detail || error.message || "An unexpected error occurred."} />}
            {results && results.length > 0 && (
                <Card><h2 className="text-2xl font-bold text-light-heading dark:text-white mb-4">Backtest Results</h2><OptimizationResultsTable results={results} /></Card>
            )}
        </div>
    );
};

export default StrategyLabPage;