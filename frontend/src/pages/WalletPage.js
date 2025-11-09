// src/pages/WalletPage.js

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// --- THIS IS THE FIX ---
// Use the correct function names as exported from the apiService file.
import { fetchWalletBalances, fetchUserPortfolio } from '../api/apiService';

// UI Components
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { FaWallet, FaPlus, FaArrowDown, FaPaperPlane } from 'react-icons/fa';

// A reusable component for displaying a single asset's balance
const BalanceItem = ({ asset, amount, usd_value, source }) => {
    // Ensure values are valid numbers before formatting
    const displayAmount = Number(amount) || 0;
    const displayUsdValue = Number(usd_value) || 0;

    return (
        <div className="flex items-center justify-between p-3 bg-light-main dark:bg-primary rounded-md hover:bg-light-hover dark:hover:bg-border-color transition-colors">
            <div>
                <p className="font-semibold text-light-heading dark:text-white">{asset}</p>
                <p className="text-xs text-light-muted dark:text-gray-400">{source}</p>
            </div>
            <div className="text-right font-mono">
                <p className="text-light-text dark:text-white">{displayAmount.toFixed(6)}</p>
                <p className="text-sm text-light-muted dark:text-light-gray">
                    ${displayUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
            </div>
        </div>
    );
};

const WalletPage = () => {
    // Fetches from the internal custodial ledger (/api/wallet/balances)
    const { data: custodialResponse, isLoading: isCustodialLoading } = useQuery({
        queryKey: ['walletBalances'],
        queryFn: fetchWalletBalances, // Use correct function name
        refetchInterval: 30000, // Refetch every 30 seconds
    });

    // Fetches from the unified non-custodial endpoint (/api/users/me/portfolio)
    const { data: nonCustodialResponse, isLoading: isNonCustodialLoading } = useQuery({
        queryKey: ['userPortfolio'],
        queryFn: fetchUserPortfolio, // Use correct function name
        refetchInterval: 30000,
    });

    // Safely access data with optional chaining and provide default empty arrays
    const custodialWallets = custodialResponse?.data || [];
    const nonCustodialPortfolio = nonCustodialResponse?.data || [];

    // Safely calculate total values
    const custodialTotal = custodialWallets.reduce((sum, wallet) => {
        // A more robust implementation would fetch prices for all assets.
        // For now, we assume non-USD/USDT assets have a value of 0 in this section.
        if (['USD', 'USDT'].includes(wallet.asset)) {
            return sum + parseFloat(wallet.balance);
        }
        return sum;
    }, 0);

    const nonCustodialTotal = nonCustodialPortfolio.reduce((sum, asset) => sum + asset.usd_value, 0);
    const grandTotal = custodialTotal + nonCustodialTotal;
    const isLoading = isCustodialLoading || isNonCustodialLoading;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">My Wallets</h1>
                    <p className="text-lg text-light-gray mt-1">
                        Total Estimated Value:
                        <span className="font-bold text-white ml-2">${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </p>
                </div>
                <div className="flex space-x-2">
                    <Button variant="secondary"><FaPlus className="mr-2" /> Deposit</Button>
                    <Button variant="secondary"><FaArrowDown className="mr-2" /> Withdraw</Button>
                    <Button><FaPaperPlane className="mr-2" /> Swap / Send</Button>
                </div>
            </div>

            {/* Custodial Section */}
            <Card className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-4">Custodial Wallet</h2>
                <p className="text-sm text-light-gray mb-4">Funds managed directly by the QuantumLeap platform.</p>
                {isLoading ? <Spinner /> : (
                    custodialWallets.length > 0 ? (
                        <div className="space-y-2">
                            {custodialWallets.map(wallet => (
                                <BalanceItem
                                    key={wallet.asset}
                                    asset={wallet.asset}
                                    amount={wallet.balance}
                                    usd_value={parseFloat(wallet.balance)} // Assuming 1:1 for this example
                                    source="Platform Wallet"
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-8">No custodial balances found.</p>
                    )
                )}
            </Card>

            {/* Non-Custodial Section */}
            <Card>
                <h2 className="text-xl font-semibold text-white mb-4">Non-Custodial (Connected Accounts)</h2>
                <p className="text-sm text-light-gray mb-4">Funds held in your personal exchange and broker accounts.</p>
                {isLoading ? <Spinner /> : (
                    nonCustodialPortfolio.length > 0 ? (
                        <div className="space-y-2">
                            {nonCustodialPortfolio.map(asset => (
                                <BalanceItem
                                    key={`${asset.asset}-${asset.sources.join('-')}`}
                                    asset={asset.asset}
                                    amount={asset.amount}
                                    usd_value={asset.usd_value}
                                    source={asset.sources.join(', ')}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-8">No connected accounts or non-custodial balances found.</p>
                    )
                )}
            </Card>
        </div>
    );
};

export default WalletPage;
