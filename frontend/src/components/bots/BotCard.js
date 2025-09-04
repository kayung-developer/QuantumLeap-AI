// src/components/bots/BotCard.js

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../common/Card';
import Button from '../common/Button';
import { FaPlay, FaStop, FaEye, FaCheckCircle, FaExclamationCircle, FaShieldAlt } from 'react-icons/fa';

const BotCard = ({ bot, onStart, onStop, isMutating }) => {
    const navigate = useNavigate();

    return (
        <Card className="flex flex-col justify-between hover:border-accent transition-colors duration-200">
            {/* --- Top Section: Bot Info & Status --- */}
            <div>
                <div className="flex items-start justify-between mb-3">
                    {/* Left side: Name and Symbol */}
                    <div>
                        <h3 className="text-xl font-bold text-white truncate" title={bot.name}>{bot.name}</h3>
                        <p className="text-sm text-light-gray font-mono">{bot.symbol} on {bot.exchange}</p>
                    </div>

                    {/* Right side: Icons and Status Badge */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                        {/* Shield icon appears if Take Profit or Stop Loss is set */}
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
                    <p>
                        <span className="font-semibold text-light-gray w-20 inline-block">Strategy:</span>
                        <span className="text-white">{bot.strategy_name.replace(/_/g, ' ')}</span>
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
            </div>
        </Card>
    );
};

export default BotCard;