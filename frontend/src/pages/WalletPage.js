// src/pages/WalletPage.js

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWalletBalances, fetchUserPortfolio } from '../api/apiService';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { FaPlus, FaArrowDown, FaPaperPlane, FaWallet } from 'react-icons/fa';
import Alert from '../components/common/Alert';
import DepositModal from '../components/wallet/DepositModal';
import SwapModal from '../components/wallet/SwapModal';

const BalanceItem = ({ asset, amount, usd_value, source }) => {
    // Formatting helper
    const fmtAmount = (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return '0.00';
        return num < 0.0001 ? num.toExponential(4) : num.toLocaleString(undefined, { maximumFractionDigits: 6 });
    };

    const fmtUSD = (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return '0.00';
        return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    return (
        <div className="flex items-center justify-between p-4 bg-light-main dark:bg-primary rounded-lg border border-light-border dark:border-border-color mb-2">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-light-secondary dark:bg-secondary rounded-full">
                    <FaWallet className="text-accent" />
                </div>
                <div>
                    <p className="font-bold text-light-heading dark:text-white text-lg">{asset}</p>
                    <p className="text-xs text-light-muted dark:text-gray-400 font-mono">{source}</p>
                </div>
            </div>
            <div className="text-right">
                <p className="font-mono text-light-heading dark:text-white font-semibold">{fmtAmount(amount)}</p>
                <p className="text-sm text-light-muted dark:text-gray-400">{fmtUSD(usd_value)}</p>
            </div>
        </div>
    );
};

const WalletPage = () => {
    const [isDepositOpen, setIsDepositOpen] = React.useState(false);
    const [isSwapOpen, setIsSwapOpen] = React.useState(false);

    // 1. Fetch Custodial (Internal) Balances
    const { data: custodialRes, isLoading: load1 } = useQuery({
        queryKey: ['walletBalances'],
        queryFn: fetchWalletBalances,
    });

    // 2. Fetch Non-Custodial (MT5/External) Portfolio
    const { data: nonCustodialRes, isLoading: load2 } = useQuery({
        queryKey: ['userPortfolio'],
        queryFn: fetchUserPortfolio,
    });

    // 3. Process Custodial Data
    // Note: Custodial API typically returns { asset: "BTC", balance: "0.5" } without usd_value.
    // We will estimate USD value here for display purposes if missing.
    const custodialWallets = useMemo(() => {
        const data = Array.isArray(custodialRes?.data) ? custodialRes.data : [];
        return data.map(w => {
            const bal = parseFloat(w.balance);
            // Simple estimation for common stablecoins, others might show 0 USD in custodial view
            const estimatedPrice = ['USD', 'USDT', 'USDC'].includes(w.asset) ? 1 : 0; 
            return {
                ...w,
                usd_value: bal * estimatedPrice,
                source: "QuantumLeap Vault"
            };
        });
    }, [custodialRes]);

    // 4. Process Non-Custodial Data (Backend does pricing for this)
    const nonCustodialPortfolio = useMemo(() => {
        return Array.isArray(nonCustodialRes?.data) ? nonCustodialRes.data : [];
    }, [nonCustodialRes]);

    // 5. Calculate Grand Total
    const totalBalance = useMemo(() => {
        const custTotal = custodialWallets.reduce((acc, curr) => acc + (parseFloat(curr.usd_value) || 0), 0);
        const nonCustTotal = nonCustodialPortfolio.reduce((acc, curr) => acc + (parseFloat(curr.usd_value) || 0), 0);
        return custTotal + nonCustTotal;
    }, [custodialWallets, nonCustodialPortfolio]);

    const isLoading = load1 || load2;

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-accent to-blue-600 p-6 rounded-2xl text-white shadow-lg">
                <div>
                    <h1 className="text-sm font-medium opacity-90 uppercase tracking-wider">Total Net Worth</h1>
                    <div className="text-4xl font-bold mt-1">
                        {isLoading ? (
                            <span className="animate-pulse">Loading...</span>
                        ) : (
                            <span>${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => setIsDepositOpen(true)} className="bg-white text-accent hover:bg-gray-100 border-none">
                        <FaPlus className="mr-2" /> Deposit
                    </Button>
                    <Button onClick={() => setIsSwapOpen(true)} className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-sm">
                        <FaPaperPlane className="mr-2" /> Swap
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Custodial Wallet Card */}
                <Card title="Custodial Wallet (Internal)">
                    {isLoading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
                        custodialWallets.length > 0 ? (
                            <div className="mt-4">
                                {custodialWallets.map((wallet, idx) => (
                                    <BalanceItem
                                        key={idx}
                                        asset={wallet.asset}
                                        amount={wallet.balance}
                                        usd_value={wallet.usd_value}
                                        source="Internal Vault"
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-light-muted dark:text-gray-500">
                                <p>No funds in custodial wallet.</p>
                            </div>
                        )
                    )}
                </Card>

                {/* Connected Accounts Card */}
                <Card title="Connected Accounts (MT5 / API)">
                    {isLoading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
                        nonCustodialPortfolio.length > 0 ? (
                            <div className="mt-4">
                                {nonCustodialPortfolio.map((item, idx) => (
                                    <BalanceItem
                                        key={idx}
                                        asset={item.asset}
                                        amount={item.amount}
                                        usd_value={item.usd_value}
                                        source={(item.sources || []).join(', ') || 'External'}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-light-muted dark:text-gray-500">
                                <p>No external balances found.</p>
                                <p className="text-xs mt-2">Connect MT5 or Exchanges in Settings to view balances here.</p>
                            </div>
                        )
                    )}
                </Card>
            </div>

            {/* Modals */}
            <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} asset="USDT" />
            <SwapModal isOpen={isSwapOpen} onClose={() => setIsSwapOpen(false)} balances={custodialWallets} />
        </div>
    );
};

export default WalletPage;