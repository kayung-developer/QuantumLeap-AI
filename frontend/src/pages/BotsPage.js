// src/pages/BotsPage.js

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserBots, startBot, stopBot, createBot } from '../api/apiService';
import BotCard from '../components/bots/BotCard';
import CreateBotForm from '../components/bots/CreateBotForm';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import Modal from '../components/common/Modal';
import Card from '../components/common/Card';
import { FaPlus, FaTelegramPlane, FaRobot } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import TelegramLinkModal from '../components/bots/TelegramLinkModal';

// --- NEW: Import the custom hook and toast for notifications ---
import { useApiMutation } from '../hooks/useApiMutation';
import toast from 'react-hot-toast'; // Still needed for custom success actions

const BotsPage = () => {
    const queryClient = useQueryClient();
    const { profile } = useAuth();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);

    const { data: botsResponse, isLoading, error } = useQuery({
        queryKey: ['bots'],
        queryFn: fetchUserBots
    });

    // --- REFACTORED: Mutations now use the robust custom hook for automatic notifications ---
    const startMutation = useApiMutation(startBot, {
        successMessage: 'Bot started successfully!',
        invalidateQueries: ['bots', 'userBots'] // Invalidate both keys for consistency
    });

    const stopMutation = useApiMutation(stopBot, {
        successMessage: 'Bot stopped successfully!',
        invalidateQueries: ['bots', 'userBots']
    });

    const createMutation = useApiMutation(createBot, {
        // We handle the success message manually here to also close the modal
        onSuccess: () => {
            toast.success('Bot created successfully!');
            setIsCreateModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            queryClient.invalidateQueries({ queryKey: ['userBots'] });
        }
    });

    // --- All existing logic below remains unchanged ---
    const planLimits = useMemo(() => ({ basic: 1, premium: 5, ultimate: 20 }), []);
    const botsCount = botsResponse?.data.length || 0;
    const currentPlan = profile?.subscription_plan || 'basic';
    const limitReached = botsCount >= planLimits[currentPlan] && profile?.role !== 'superuser';
    const isTelegramLinked = !!profile?.telegram_chat_id;

    if (isLoading) return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
    if (error) return <Alert type="error" message={`Failed to load bots: ${error.message}`} />;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-light-heading dark:text-white">My Trading Bots</h1>
                    <p className="text-light-muted dark:text-light-gray mt-1">Automate your strategies and manage your portfolio.</p>
                </div>
                <div className="text-left md:text-right">
                    <Button onClick={() => setIsCreateModalOpen(true)} disabled={limitReached}><FaPlus className="mr-2" /> Create New Bot</Button>
                    {limitReached && <p className="text-xs text-warning mt-1">You've reached the bot limit for the {currentPlan} plan.</p>}
                </div>
            </div>

            {!isTelegramLinked && (
                 <div className="bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-lg relative mb-6 flex items-center justify-between">
                    <div className="flex items-center">
                        <FaTelegramPlane className="text-2xl mr-4" />
                        <div>
                            <p className="font-bold">Enable Telegram Notifications</p>
                            <p className="text-sm">Get real-time trade alerts and status updates from your bots.</p>
                        </div>
                    </div>
                    <Button onClick={() => setIsTelegramModalOpen(true)} variant="secondary">Link Account</Button>
                </div>
            )}

            {botsResponse?.data.length === 0 ? (
                <Card className="text-center py-20">
                    <FaRobot className="mx-auto text-6xl text-light-border dark:text-border-color mb-4" />
                    <h2 className="text-2xl font-bold text-light-heading dark:text-white">Your Dashboard is Ready</h2>
                    <p className="text-light-muted dark:text-light-gray mt-2 mb-6">You haven't created any bots yet. Click the button below to launch your first one.</p>
                    <Button onClick={() => setIsCreateModalOpen(true)}><FaPlus className="mr-2" /> Create Your First Bot</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {botsResponse?.data.map(bot => (
                        <BotCard
                            key={bot.id}
                            bot={bot}
                            onStart={startMutation.mutate}
                            onStop={stopMutation.mutate}
                            isMutating={startMutation.isLoading || stopMutation.isLoading}
                        />
                    ))}
                </div>
            )}

            <Modal title="Create New Trading Bot" isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
                <CreateBotForm onSubmit={createMutation.mutate} isLoading={createMutation.isLoading} />
            </Modal>
            <TelegramLinkModal isOpen={isTelegramModalOpen} onClose={() => setIsTelegramModalOpen(false)} />
        </div>
    );
};

export default BotsPage;