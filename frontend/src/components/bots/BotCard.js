// src/components/bots/BotCard.js

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../common/Card';
import Button from '../common/Button';
import {
    FaPlay, FaStop, FaEye, FaCheckCircle, FaExclamationCircle, FaShieldAlt,
    FaProjectDiagram, FaBroadcastTower, FaEdit, FaWaveSquare, FaChartLine, FaChartArea,
    FaTh, FaCompressArrowsAlt, FaPoll, FaCloud, FaBrain, FaSitemap, FaDollarSign   // Import new icons
} from 'react-icons/fa';

const BotCard = ({ bot, onStart, onStop, isMutating }) => {
    const navigate = useNavigate();

    // --- THIS IS THE ROBUST FIX, INTEGRATED INTO YOUR DESIGN ---
    // A helper function to safely get and format the strategy display name and icon.
    const getStrategyDisplay = () => {
        // Handle special strategy types first
        if (bot.strategy_type === 'visual') {
            return { name: "Visual Strategy", icon: <FaProjectDiagram className="text-purple-400" /> };
        }
        if (bot.strategy_name === 'TradingView_Alert') {
            return { name: "TradingView Alert", icon: <FaBroadcastTower className="text-blue-400" /> };
        }

        // --- NEW: Add specific icons for all other pre-built strategies ---
        const strategyIcons = {
            "RSI_MACD_Crossover": <FaWaveSquare className="text-teal-400" />,
            "MA_Cross": <FaChartLine className="text-blue-400" />,
            "Bollinger_Bands": <FaChartArea className="text-indigo-400" />,
            "Smart_Money_Concepts": <FaDollarSign className="text-green-400" />,
            "Grid_Trading": <FaTh className="text-gray-400" />,
            "Volatility_Squeeze": <FaCompressArrowsAlt className="text-orange-400" />,
            "SuperTrend_ADX_Filter": <FaPoll className="text-pink-400" />,
            "Ichimoku_Cloud_Breakout": <FaCloud className="text-cyan-400" />,
            "AI_Signal_Confirmation": <FaBrain className="text-accent" />,
            "Optimizer_Portfolio": <FaSitemap className="text-yellow-400" />,
        };

        const name = bot.strategy_name?.replace(/_/g, ' ') ?? "Unnamed Strategy";
        const icon = strategyIcons[bot.strategy_name] || null;

        return { name, icon };
    };


    const strategyDisplay = getStrategyDisplay();

    return (
        <Card className="flex flex-col justify-between hover:border-accent transition-colors duration-200">
            {/* --- Top Section: Bot Info & Status --- */}
            <div>
                <div className="flex items-start justify-between mb-3">
                    {/* Left side: Name and Symbol */}
                    <div>
                        <h3 className="text-xl font-bold text-white truncate" title={bot.name}>{bot.name}</h3>
                        <p className="text-sm text-light-gray font-mono">{bot.symbol} on {bot.exchange.toUpperCase()}</p>
                    </div>

                    {/* Right side: Icons and Status Badge */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                        {(bot.take_profit_percentage || bot.stop_loss_percentage) && (
                            <FaShieldAlt className="text-accent" title="Risk Management Enabled" />
                        )}
                        <div className={`flex items-center text-xs px-2 py-1 rounded-full ${bot.is_active ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                            {bot.is_active ? <FaCheckCircle className="mr-1.5" /> : <FaExclamationCircle className="mr-1.5" />}
                            {bot.is_active ? 'Active' : 'Inactive'}
                        </div>
                    </div>
                </div>

                {/* --- Middle Section: Strategy Details --- */}
                <div className="text-sm space-y-2 bg-primary p-3 rounded-md border border-border-color">
                    <p className="flex items-center">
                        <span className="font-semibold text-light-gray w-20 inline-block">Strategy:</span>
                        {/* Use the new helper to display the strategy name and icon */}
                        {strategyDisplay.icon && <span className="mr-2">{strategyDisplay.icon}</span>}
                        <span className="text-white font-semibold">{strategyDisplay.name}</span>
                    </p>
                    <p>
                        <span className="font-semibold text-light-gray w-20 inline-block">Mode:</span>
                        <span className="text-white">{bot.is_paper_trading ? 'Paper Trading' : 'Live'}</span>
                    </p>
                </div>
            </div>

            {/* --- Bottom Section: Action Buttons --- */}
            <div className="border-t border-border-color mt-4 pt-4 flex space-x-2">
                {bot.is_active ? (
                    <Button
                        variant="danger"
                        onClick={() => onStop(bot.id)}
                        className="w-full"
                        isLoading={isMutating}
                    >
                        <FaStop className="mr-2"/>Stop
                    </Button>
                ) : (
                    <Button
                        variant="success"
                        onClick={() => onStart(bot.id)}
                        className="w-full"
                        isLoading={isMutating}
                    >
                        <FaPlay className="mr-2"/>Start
                    </Button>
                )}
                <Button
                    variant="secondary"
                    onClick={() => navigate(`/dashboard/bots/${bot.id}`)}
                    title="View Details"
                >
                    <FaEye/>
                </Button>
                {bot.strategy_type === 'visual' && (
                    <Button
                        variant="secondary"
                        onClick={() => navigate('/dashboard/builder', { state: { bot: bot } })}
                        title="Edit Visual Strategy"
                    >
                        <FaEdit />
                    </Button>
                )}
            </div>
        </Card>
    );
};

export default BotCard;