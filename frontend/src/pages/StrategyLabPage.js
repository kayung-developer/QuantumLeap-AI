import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// API and Hooks
import { useAuth } from '../contexts/AuthContext';
import { useApiMutation } from '../hooks/useApiMutation';
import { runSingleBacktest, startOptimization, getOptimizationStatus, fetchUserBots } from '../api/apiService';

// UI Components
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';
import StrategySensei from '../components/strategylab/StrategySensei';
import OptimizationResultsTable from '../components/strategylab/OptimizationResultsTable';
import ShareBotModal from '../components/bots/ShareBotModal';
import { FaFlask, FaCog, FaSync, FaRocket } from 'react-icons/fa';

// Configuration for strategy parameters
const STRATEGY_PARAMETERS = {
    MA_Cross: [
        { name: 'short_window', label: 'Short MA', type: 'range', default: [10, 30, 5], singleDefault: 20 },
        { name: 'long_window', label: 'Long MA', type: 'range', default: [50, 200, 50], singleDefault: 100 },
    ],
    Bollinger_Bands: [
        { name: 'window', label: 'BB Window', type: 'range', default: [15, 25, 5], singleDefault: 20 },
        { name: 'std_dev', label: 'Std. Dev.', type: 'range', default: [2.0, 3.0, 0.5], singleDefault: 2.0 },
    ],
    Smart_Money_Concepts: [
        { name: 'risk_reward_ratio', label: 'Risk/Reward Ratio', type: 'range', default: [1.5, 3.0, 0.5], singleDefault: 2.0 },
    ],
    RSI_MACD_Crossover: [
        { name: 'rsi_period', label: 'RSI Period', type: 'range', default: [10, 20, 2], singleDefault: 14 },
        { name: 'macd_fast', label: 'MACD Fast', type: 'range', default: [8, 16, 2], singleDefault: 12 },
        { name: 'macd_slow', label: 'MACD Slow', type: 'range', default: [20, 30, 2], singleDefault: 26 },
    ],
};

// Helper function to generate a numerical range
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
        end_date: new Date().toISOString().split('T')[0],
        strategy_name: 'MA_Cross',
        params: {},
    });

    const [mode, setMode] = useState('backtest'); // 'backtest' or 'optimize'
    const [backtestResult, setBacktestResult] = useState(null);
    const [optimizationResults, setOptimizationResults] = useState(null);
    const [selectedBot, setSelectedBot] = useState(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [taskId, setTaskId] = useState(null);
    const [taskStatus, setTaskStatus] = useState(null);

    const { data: botsResponse } = useQuery({ queryKey: ['userBots'], queryFn: fetchUserBots });

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

const singleBacktestMutation = useApiMutation(runSingleBacktest, {
        onSuccess: (data) => {
            // --- MODIFIED: The single result is now formatted for the OptimizationResultsTable ---
            const resultForTable = { metrics: data.data, params: data.data.params, strategy: data.data.strategy };
            setBacktestResult(resultForTable);
            setOptimizationResults(null);
            const testedBot = botsResponse?.data.find(b => b.strategy_name === config.strategy_name);
            setSelectedBot(testedBot);
        }
    });

    const optimizeMutation = useApiMutation(startOptimization, {
        onSuccess: (data) => {
            setTaskId(data.data.task_id);
            setTaskStatus({ status: 'PENDING', progress: 0 });
            setBacktestResult(null);
            setOptimizationResults(null);
            toast.success('Optimization task has started!');
        }
    });

    useEffect(() => {
        if (!taskId || ['COMPLETED', 'FAILED'].includes(taskStatus?.status)) return;
        const interval = setInterval(async () => {
            try {
                const response = await getOptimizationStatus(taskId);
                setTaskStatus(response.data);
                if (['COMPLETED', 'FAILED'].includes(response.data.status)) {
                    if (response.data.status === 'COMPLETED') setOptimizationResults(response.data.results);
                    clearInterval(interval);
                }
            } catch (error) {
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

    const handleRunAction = (e) => {
        e.preventDefault();
        setBacktestResult(null);
        setOptimizationResults(null);
        setTaskId(null);
        setTaskStatus(null);
        setSelectedBot(null);

        if (mode === 'backtest') {
            const paramsForApi = STRATEGY_PARAMETERS[config.strategy_name]
                .reduce((acc, p) => ({ ...acc, [p.name]: p.singleDefault }), {});
            singleBacktestMutation.mutate({ ...config, strategy_params: paramsForApi });
        } else { // mode === 'optimize'
            const parameter_ranges = {};
            for (const key in config.params) {
                const { from, to, step } = config.params[key];
                if (from !== undefined && to !== undefined && step !== undefined) {
                    parameter_ranges[key] = generateRange(from, to, step);
                }
            }
            optimizeMutation.mutate({ ...config, parameter_ranges });
        }
    };

    const handleStrategySuggestion = (suggestion) => {
        if (suggestion.error) return toast.error(`Sensei says: ${suggestion.error}`);
        toast.success(`Sensei suggests: ${suggestion.explanation}`);
        setConfig(prev => ({ ...prev, strategy_name: suggestion.strategy_name }));
    };

    const hasSenseiAccess = profile?.subscription_plan === 'premium' || profile?.subscription_plan === 'ultimate';
    const isRunning = singleBacktestMutation.isLoading || optimizeMutation.isLoading || ['PENDING', 'RUNNING'].includes(taskStatus?.status);
    const error = singleBacktestMutation.error || optimizeMutation.error || (taskStatus && taskStatus.error);

    return (
        <div className="space-y-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white flex items-center"><FaFlask className="mr-3 text-accent"/>Strategy Laboratory</h1>
                <p className="text-light-gray mt-1">Discover, optimize, and publish your trading strategies.</p>
            </div>

            {hasSenseiAccess ? (
                <StrategySensei onStrategySuggested={handleStrategySuggestion} />
            ) : (
                <Card className="bg-gradient-to-r from-accent/10 to-transparent p-6 flex items-center gap-6">
                    <FaRocket className="text-5xl text-accent" />
                    <div>
                        <h3 className="text-xl font-bold text-white">Unlock the Strategy Sensei</h3>
                        <p className="text-light-gray mt-1">Upgrade to Premium to get AI-powered strategy suggestions.</p>
                    </div>
                    <Link to="/dashboard/billing" className="ml-auto"><Button>Upgrade Plan</Button></Link>
                </Card>
            )}

            <Card>
                <form onSubmit={handleRunAction}>
                    <h2 className="text-2xl font-bold text-white mb-4">1. General Configuration</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input label="Symbol" name="symbol" value={config.symbol} onChange={handleInputChange} />
                        <Input label="Start Date" name="start_date" type="date" value={config.start_date} onChange={handleInputChange} />
                        <Input label="End Date" name="end_date" type="date" value={config.end_date} onChange={handleInputChange} />
                        <Input label="Exchange" name="exchange" value={config.exchange} onChange={handleInputChange} disabled />
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
                        <p className="text-sm text-light-gray mt-4">{mode === 'backtest' ? 'Runs a single backtest with default parameters to see baseline performance and enable publishing.' : 'Runs hundreds of backtests to find the best parameter combination for your selected strategy.'}</p>
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
                        {taskStatus?.status === 'RUNNING' && (
                            <div className="w-full max-w-md mt-4">
                                <div className="flex justify-between mb-1"><span className="text-base font-medium text-accent">Optimizing</span><span className="text-sm font-medium text-accent">{Math.round(taskStatus.progress * 100)}%</span></div>
                                <div className="w-full bg-primary rounded-full h-2.5"><div className="bg-accent h-2.5 rounded-full" style={{ width: `${taskStatus.progress * 100}%` }}></div></div>
                            </div>
                        )}
                    </div>
                </Card>
            )}
            {error && <Alert type="error" message={error.response?.data?.detail || error.message} />}

            {(backtestResult || optimizationResults) && (
                 <Card>
                    <h2 className="text-2xl font-bold text-white mb-4">Results</h2>
                    {backtestResult && <OptimizationResultsTable results={[backtestResult]} />}
                    {optimizationResults && <OptimizationResultsTable results={optimizationResults} />}
}

                    {backtestResult && selectedBot && (
                        <div className="mt-6 pt-6 border-t border-border-color text-center">
                            <h3 className="text-lg font-semibold text-white">Ready to Share?</h3>
                            <p className="text-sm text-light-gray my-2">Publish this strategy and its results to the Community Marketplace.</p>
                            <Button onClick={() => setIsShareModalOpen(true)} variant="success">Publish This Strategy</Button>
                        </div>
                    )}
                </Card>
            )}

            {isShareModalOpen && selectedBot && (
                <ShareBotModal
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    bot={selectedBot}
                    initialBacktestResults={backtestResult}
                />
            )}
        </div>
    );
};

export default StrategyLabPage;