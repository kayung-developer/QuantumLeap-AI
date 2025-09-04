// src/components/marketplace/SubscriptionModal.js

import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { FaPaypal, FaStripe, FaGem } from 'react-icons/fa'; // Assuming you might add Stripe later
import { useAuth } from '../../contexts/AuthContext';

const SubscriptionModal = ({ bot, isOpen, onClose, onConfirm, isMutating }) => {
    const { profile } = useAuth();

    if (!bot) return null;

    return (
        <Modal title="Subscribe to Premium Strategy" isOpen={isOpen} onClose={onClose}>
            <div className="text-center">
                <FaGem className="mx-auto text-5xl text-accent mb-4" />
                <h3 className="text-lg font-bold text-light-heading dark:text-white">
                    You are subscribing to <span className="text-accent">{bot.name}</span>
                </h3>
                <p className="text-sm text-light-muted dark:text-light-gray mt-2">
                    This will grant you 30 days of access to clone and use this strategy.
                </p>

                <div className="my-6 p-4 bg-light-primary dark:bg-primary border border-light-border dark:border-border-color rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-light-text dark:text-white">Total Due Today:</span>
                        <span className="text-2xl font-bold text-accent">${bot.price_usd_monthly.toFixed(2)}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-xs text-light-muted dark:text-light-gray">Choose your payment method:</p>
                    <Button
                        onClick={() => onConfirm('paypal')}
                        isLoading={isMutating}
                        className="w-full"
                    >
                        <FaPaypal className="mr-3 text-xl" /> Pay with PayPal
                    </Button>
                    <Button
                        onClick={() => onConfirm('paystack')} // Example for Paystack
                        isLoading={isMutating}
                        variant="secondary"
                        className="w-full"
                    >
                         Pay with Paystack
                    </Button>
                </div>
                 <p className="text-xs text-light-muted dark:text-light-gray mt-4">
                    By confirming, you agree to our terms of service for one-time purchases.
                </p>
            </div>
        </Modal>
    );
};

export default SubscriptionModal;