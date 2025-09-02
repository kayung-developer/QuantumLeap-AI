import React, { useState } from 'react'; // <-- Import useState
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMarketplaceStrategies, cloneStrategy } from '../api/apiService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import { FaUsers, FaCopy, FaChartLine } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import StrategyCard from '../components/marketplace/StrategyCard'; // <-- Import the component
import SubscriptionModal from '../components/marketplace/SubscriptionModal'; // <-- You will need to create this file

const MarketplacePage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [subscribingBot, setSubscribingBot] = useState(null); // <-- Initialize state

    const { data: strategies, isLoading, error } = useQuery({ queryKey: ['marketplaceStrategies'], queryFn: getMarketplaceStrategies });

    const cloneMutation = useMutation({
        mutationFn: cloneStrategy,
        onSuccess: (data) => {
            toast.success(`Strategy cloned! New bot created: "${data.data.name}"`);
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            navigate('/dashboard/bots');
        },
        onError: (err) => toast.error(`Failed to clone: ${err.message}`),
    });

    // You will need to add the subscription mutation logic here later
    const subscriptionMutation = { isLoading: false }; // Placeholder

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-light-heading dark:text-white flex items-center"><FaChartLine className="mr-3 text-accent"/> Strategy Marketplace</h1>
                <p className="text-light-muted dark:text-light-gray mt-1">Discover, backtest, and clone profitable strategies from the community.</p>
            </div>

            {isLoading && <div className="flex justify-center p-16"><Spinner size="lg"/></div>}
            {error && <Alert type="error" message={`Failed to load marketplace: ${error.message}`} />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {strategies?.data.map(strategy => (
                    <StrategyCard
                        key={strategy.id}
                        strategy={strategy}
                        onClone={cloneMutation.mutate}
                        onSubscribe={setSubscribingBot}
                        isMutating={cloneMutation.isLoading || subscriptionMutation.isLoading}
                    />
                ))}
            </div>

            {subscribingBot && (
                <SubscriptionModal
                    bot={subscribingBot}
                    isOpen={!!subscribingBot}
                    onClose={() => setSubscribingBot(null)}
                    onConfirm={(gateway) => subscriptionMutation.mutate({ botId: subscribingBot.id, gateway })}
                />
            )}
        </div>
    );
};

export default MarketplacePage;