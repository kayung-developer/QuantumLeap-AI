import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchMarketplaceStrategies } from '../api/apiService'; // We'll add this
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import Button from '../components/common/Button';
import { FaRobot, FaChartLine, FaUsers } from 'react-icons/fa';

// A dedicated component for each strategy card in the marketplace
const StrategyCard = ({ strategy }) => {
    const pnl = strategy.backtest_results_cache?.total_return_pct || 0;
    const pnlColor = pnl >= 0 ? 'text-success' : 'text-danger';
    const authorName = strategy.owner?.first_name || 'Anonymous';

    return (
        <Card hoverEffect={true} className="flex flex-col">
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-white">{strategy.name}</h3>
                    {strategy.publish_type === 'subscription' && (
                        <span className="text-xs font-bold bg-accent text-white px-2 py-1 rounded-full">PREMIUM</span>
                    )}
                </div>
                <p className="text-sm text-light-gray mt-1">{strategy.symbol} on {strategy.exchange.toUpperCase()}</p>
                <p className="text-xs text-gray-400 mt-2 h-10 overflow-hidden">{strategy.description || "No description provided."}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center my-4 pt-4 border-t border-border-color">
                <div>
                    <p className="text-xs text-light-gray">Backtest P&L</p>
                    <p className={`text-xl font-bold ${pnlColor}`}>{pnl.toFixed(2)}%</p>
                </div>
                <div>
                    <p className="text-xs text-light-gray">Clones</p>
                    <p className="text-xl font-bold text-white flex items-center justify-center">
                        <FaUsers className="mr-2" /> {strategy.clone_count}
                    </p>
                </div>
            </div>

            <div className="flex-shrink-0">
                <Link to={`/marketplace/bot/${strategy.id}`}>
                    <Button className="w-full">View Details & Clone</Button>
                </Link>
            </div>
        </Card>
    );
};


const MarketplacePage = () => {
    const { data: strategiesResponse, isLoading, error } = useQuery({
        queryKey: ['marketplaceStrategies'],
        queryFn: fetchMarketplaceStrategies,
    });

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    if (error) {
        return <Alert type="error" message={`Failed to load marketplace: ${error.message}`} />;
    }

    const strategies = strategiesResponse?.data || [];

    return (
        <div>
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white">Strategy Marketplace</h1>
                <p className="text-lg text-light-gray mt-2">Discover, analyze, and clone top-performing strategies from the QuantumLeap community.</p>
            </div>

            {strategies.length === 0 ? (
                <Card className="text-center py-20">
                    <FaRobot className="mx-auto text-6xl text-border-color mb-4" />
                    <h2 className="text-2xl font-bold text-white">The Marketplace is Growing</h2>
                    <p className="text-light-gray mt-2">No public strategies have been shared yet. Be the first to publish your bot!</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {strategies.map(strategy => (
                        <StrategyCard key={strategy.id} strategy={strategy} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default MarketplacePage;