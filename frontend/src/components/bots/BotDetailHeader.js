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
                        <h1 className="text-3xl font-bold text-white">{bot?.name}</h1>
                        <p className="text-light-gray font-mono">{bot?.exchange.toUpperCase()} - {bot?.symbol}</p>
                        <div className={`mt-2 flex items-center text-sm px-2.5 py-1 rounded-full w-fit ${bot?.is_active ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
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