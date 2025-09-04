// src/components/homepage/PricingSection.js

import React from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import { FaCheckCircle, FaStar, FaRocket, FaGem } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const plans = [
    {
        id: 'basic',
        name: 'Basic',
        price: '0',
        icon: <FaStar />,
        description: 'Perfect for getting started and automating your first strategy.',
        features: [
            '1 Trading Bot Limit',
            'Spot Trading Enabled',
            'Full Backtesting Suite',
            'Custodial Wallet Access',
            'Marketplace (Free Bots)',
        ],
        highlight: false
    },
    {
        id: 'premium',
        name: 'Premium',
        price: '29.99',
        icon: <FaRocket />,
        description: 'For active traders who need more bots and AI-powered insights.',
        features: [
            'Includes all Basic features',
            '5 Trading Bots Limit',
            'Strategy Sensei (AI Suggestions)',
            'AI Market Sentiment Analysis',
            'Subscribe to Premium Bots',
        ],
        highlight: true
    },
    {
        id: 'ultimate',
        name: 'Ultimate',
        price: '79.99',
        icon: <FaGem />,
        description: 'The complete toolkit for professional and quantitative traders.',
        features: [
            'Includes all Premium features',
            '20 Trading Bots Limit',
            'No-Code Visual Strategy Builder',
            'Futures Trading (up to 125x)',
            'Advanced Performance Analytics',
            'Advanced Position Sizing Models',
            'Platform API Access',
        ],
        highlight: false
    },
];

const PricingCard = ({ plan }) => (
    <Card className={`flex flex-col text-center p-8 relative ${plan.highlight ? 'border-accent scale-105 shadow-accent/20' : 'border-light-border dark:border-border-color'}`}>
        {plan.highlight && (
            <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                Most Popular
            </div>
        )}

        <div className="mx-auto text-4xl text-accent mb-4">{plan.icon}</div>
        <h3 className="text-2xl font-bold text-light-heading dark:text-white">{plan.name}</h3>
        <p className="text-light-muted dark:text-light-gray my-4 h-12">{plan.description}</p>

        <div className="my-6">
            <span className="text-5xl font-extrabold text-light-heading dark:text-white">${plan.price}</span>
            <span className="text-base font-medium text-light-muted dark:text-light-gray">/month</span>
        </div>

        <ul className="space-y-4 my-6 text-left flex-grow">
            {plan.features.map(feature => (
                <li key={feature} className="flex items-start">
                    <FaCheckCircle className="text-success mr-3 mt-1 flex-shrink-0" />
                    <span className="text-light-muted dark:text-light-gray">{feature}</span>
                </li>
            ))}
        </ul>

        <Link to="/register" className="mt-6">
            <Button className="w-full" variant={plan.highlight ? 'primary' : 'secondary'}>
                {plan.price === '0' ? 'Get Started' : 'Choose Plan'}
            </Button>
        </Link>
    </Card>
);

const PricingSection = () => {
    return (
        <section id="pricing" className="py-20">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-light-heading dark:text-white">
                    Choose the Plan That's Right for You
                </h2>
                <p className="mt-4 text-light-muted dark:text-light-gray max-w-2xl mx-auto">
                    Simple, transparent pricing. Unlock powerful features as you grow. Cancel anytime.
                </p>
                <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start max-w-6xl mx-auto">
                    {plans.map(plan => <PricingCard key={plan.id} plan={plan} />)}
                </div>
            </div>
        </section>
    );
};

export default PricingSection;