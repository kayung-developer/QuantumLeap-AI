// src/components/bots/TelegramLinkModal.js

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTelegramLinkCode } from '../../api/apiService';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';
import Alert from '../common/Alert';

const TelegramLinkModal = ({ isOpen, onClose }) => {
    const { data: linkInfoResponse, isLoading, isError, error } = useQuery({
        queryKey: ['telegramLinkCode'],
        queryFn: getTelegramLinkCode,
        enabled: isOpen, // Only fetch the code when the modal is open
        staleTime: 5 * 60 * 1000, // The code is valid for a while, no need to refetch constantly
        refetchOnWindowFocus: false,
    });

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        // You could add a small "Copied!" notification here
    };

    return (
        <Modal title="Enable Telegram Notifications" isOpen={isOpen} onClose={onClose}>
            {isLoading && (
                <div className="flex justify-center p-8">
                    <Spinner />
                </div>
            )}
            {isError && (
                <Alert type="error" message={error.response?.data?.detail || 'Failed to generate link code.'} />
            )}
            {linkInfoResponse && (
                <div className="space-y-4 text-center">
                    <p className="text-light-gray">
                        Get real-time alerts for trades, bot status changes, and errors directly in Telegram.
                    </p>
                    <div>
                        <p className="font-semibold text-white">Step 1: Open Telegram</p>
                        <p className="text-sm text-light-gray">
                            Search for our bot and start a chat:
                        </p>
                        <a
                            href={`https://t.me/${linkInfoResponse.data.bot_username.substring(1)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent font-bold text-lg hover:underline"
                        >
                            {linkInfoResponse.data.bot_username}
                        </a>
                    </div>
                    <div>
                        <p className="font-semibold text-white">Step 2: Send This Message</p>
                        <p className="text-sm text-light-gray">
                            Copy and paste the following command into your chat with the bot.
                        </p>
                        <div
                            className="mt-2 p-3 bg-secondary border border-border-color rounded-md font-mono text-white cursor-pointer"
                            onClick={() => handleCopy(`/start ${linkInfoResponse.data.link_code}`)}
                        >
                            /start {linkInfoResponse.data.link_code}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Click to copy</p>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default TelegramLinkModal;