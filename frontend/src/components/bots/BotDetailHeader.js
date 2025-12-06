// src/components/bots/BotDetailHeader.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteBot } from '../../api/apiService';
import Card from '../common/Card';
import Button from '../common/Button';
import ShareBotModal from './ShareBotModal'; // Import the modal
import { FaCheckCircle, FaExclamationCircle, FaTrash, FaPlay, FaStop, FaShareAlt } from 'react-icons/fa';

const BotDetailHeader = ({ bot, onStart, onStop }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const deleteMutation = useMutation({
        mutationFn: deleteBot,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            navigate('/dashboard/bots');
        },
    });

    return (
        <>
            <Card className="mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">{bot?.name}</h1>
                        <p className="text-gray-600 dark:text-light-gray font-mono font-medium mt-1">
                            {bot?.exchange.toUpperCase()} <span className="text-gray-300 dark:text-gray-600">|</span> {bot?.symbol}
                        </p>
                        <div className={`mt-3 flex items-center text-sm font-bold px-3 py-1 rounded-full w-fit ${bot?.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {bot?.is_active ? <FaCheckCircle className="mr-2" /> : <FaExclamationCircle className="mr-2" />}
                            {bot?.is_active ? 'Active' : 'Inactive'}
                        </div>
                    </div>
                    <div className="flex space-x-2 mt-4 md:mt-0">
                        {bot?.is_active ? (
                            <Button variant="danger" onClick={() => onStop(bot.id)}><FaStop className="mr-2"/>Stop Bot</Button>
                        ) : (
                            <Button variant="success" onClick={() => onStart(bot.id)}><FaPlay className="mr-2"/>Start Bot</Button>
                        )}
                        <Button variant="secondary" onClick={() => setIsShareModalOpen(true)}><FaShareAlt /></Button>
                        <Button variant="secondary" onClick={() => deleteMutation.mutate(bot.id)} disabled={deleteMutation.isLoading}><FaTrash /></Button>
                    </div>
                </div>
            </Card>

            {/* The modal is rendered here but controlled by this component's state */}
            {isShareModalOpen && (
                 <ShareBotModal
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    bot={bot}
                />
            )}
        </>
    );
};

export default BotDetailHeader;