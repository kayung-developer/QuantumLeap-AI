// frontend/src/pages/BillingPage.js

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { initializePayment } from '../api/apiService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import { FaStar, FaRocket, FaGem, FaCheckCircle } from 'react-icons/fa';
import MySubscriptionsTab from '../components/billing/MySubscriptionsTab';

// --- Plan Configuration ---
const plans = [
    {
        id: 'basic', name: 'Basic', price: '$0', priceDetail: '/ month',
        description: 'Perfect for getting started and learning the ropes.',
        features: ['1 Trading Bot Limit', 'Spot Trading Enabled', 'Full Backtesting Suite', 'Custodial Wallet Access', 'Marketplace (Free Bots)'],
        icon: FaStar, iconColor: 'text-gray-400', buttonVariant: 'secondary',
    },
    {
        id: 'premium', name: 'Premium', price: '$29.99', priceDetail: '/ month',
        description: 'For active traders who need more power and insights.',
        features: ['Includes all Basic features', '5 Trading Bots Limit', 'Strategy Sensei (AI Suggestions)', 'AI Market Sentiment Analysis', 'Subscribe to Premium Bots'],
        icon: FaRocket, iconColor: 'text-accent', buttonVariant: 'primary',
        highlight: true, // This correctly marks the plan to be highlighted
    },
    {
        id: 'ultimate', name: 'Ultimate', price: '$79.99', priceDetail: '/ month',
        description: 'For professionals and power users who demand the best.',
        features: ['Includes all Premium features', '20 Trading Bots Limit', 'No-Code Visual Strategy Builder', 'Futures Trading (up to 125x)', 'Advanced Performance Analytics', 'Platform API Access'],
        icon: FaGem, iconColor: 'text-purple-400', buttonVariant: 'secondary',
    }
];

// --- Plan Card Component ---
const PlanCard = ({ plan, currentPlanId, onUpgrade, isLoading, targetPlanId }) => { // Added targetPlanId prop
    const isCurrentPlan = plan.id === currentPlanId;
    const isDowngrade = plans.findIndex(p => p.id === plan.id) < plans.findIndex(p => p.id === currentPlanId);

    let buttonText = 'Upgrade';
    if (isCurrentPlan) buttonText = 'Current Plan';
    if (isDowngrade) buttonText = 'Downgrade';

    return (
        // --- FIX: Added relative positioning and conditional scaling/border ---
        <Card className={`flex flex-col relative ${plan.highlight ? 'border-accent scale-105 shadow-accent/20' : 'border-light-border dark:border-border-color'}`}>
            {/* --- FIX: Added the "Most Popular" banner logic --- */}
            {plan.highlight && (
                <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                    Most Popular
                </div>
            )}
            <div className="flex-grow pt-4"> {/* Added padding top to make space for the banner */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-light-heading dark:text-white">{plan.name}</h3>
                    <plan.icon className={`text-3xl ${plan.iconColor}`} />
                </div>
                <p className="text-gray-600 dark:text-light-gray mb-4 h-12 font-medium">{plan.description}</p>
                <div className="mb-6">
                    <span className="text-5xl font-extrabold text-gray-900 dark:text-white">{plan.price}</span>
                    <span className="text-light-muted dark:text-light-gray">{plan.priceDetail}</span>
                </div>
                <ul className="space-y-3 text-sm text-left">
                    {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start">
                            <FaCheckCircle className="w-4 h-4 mr-3 mt-1 text-success flex-shrink-0" />
                            <span className="text-light-muted dark:text-light-gray">{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="mt-8">
                <Button
                    onClick={() => onUpgrade(plan.id)}
                    variant={isCurrentPlan ? 'secondary' : (plan.highlight ? 'primary' : 'secondary')}
                    className="w-full"
                    disabled={isCurrentPlan || isLoading}
                    isLoading={isLoading && targetPlanId === plan.id} // Show spinner only on the clicked card
                >
                    {buttonText}
                </Button>
            </div>
        </Card>
    );
};

const BillingPage = () => {
    const [activeTab, setActiveTab] = useState('plans');
    const { profile } = useAuth();
    const [targetPlanId, setTargetPlanId] = useState(null); // To track which button was clicked

    const paymentMutation = useMutation({
        mutationFn: ({ plan, gateway }) => initializePayment(plan, gateway),
        onSuccess: (data) => {
            window.location.href = data.data.payment_url;
        },
        onSettled: () => {
            setTargetPlanId(null);
        }
    });

    const handleUpgrade = (planId) => {
        setTargetPlanId(planId);
        // Defaulting to 'paypal', can add a gateway selector later if needed
        paymentMutation.mutate({ plan: planId, gateway: 'paypal' });
    };

    const currentPlanId = profile?.subscription_plan || 'basic';

     return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-light-heading dark:text-white">Billing & Subscriptions</h1>
                <p className="text-light-muted dark:text-light-gray mt-1">Manage your platform plan and strategy subscriptions.</p>
            </div>

            <div className="border-b border-light-border dark:border-border-color mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('plans')} className={`${activeTab === 'plans' ? 'border-accent text-accent' : 'border-transparent text-light-muted dark:text-light-gray hover:text-light-text dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Platform Plans
                    </button>
                    <button onClick={() => setActiveTab('strategies')} className={`${activeTab === 'strategies' ? 'border-accent text-accent' : 'border-transparent text-light-muted dark:text-light-gray hover:text-light-text dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Strategy Subscriptions
                    </button>
                </nav>
            </div>

            {activeTab === 'plans' && (
                <div>
                    <Card className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                            <h2 className="text-xl font-semibold text-light-heading dark:text-white">Your Current Plan: <span className="text-accent capitalize">{currentPlanId}</span></h2>
                            {currentPlanId !== 'basic' && (
                                <p className="text-sm text-light-muted dark:text-light-gray mt-1">
                                    Renews on: {profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).toLocaleDateString() : 'N/A'}
                                </p>
                            )}
                        </div>
                        <Button variant="secondary" className="mt-4 md:mt-0">Manage Subscription</Button>
                    </Card>

                    {paymentMutation.isError && (
                        <Alert type="error" message={`Payment initialization failed: ${paymentMutation.error.response?.data?.detail || paymentMutation.error.message}`} className="mb-6" />
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                        {plans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                currentPlanId={currentPlanId}
                                onUpgrade={handleUpgrade}
                                isLoading={paymentMutation.isLoading}
                                targetPlanId={targetPlanId} // Pass this down
                            />
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'strategies' && (
                <Card>
                    <MySubscriptionsTab />
                </Card>
            )}
        </div>
    );
};

export default BillingPage;