import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWalletBalances, fetchTransactions } from '../api/apiService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import DepositModal from '../components/wallet/DepositModal';
import SwapModal from '../components/wallet/SwapModal';
import { FaWallet, FaArrowDown, FaArrowUp, FaRandom, FaBitcoin, FaEthereum } from 'react-icons/fa';

const assetIcons = {
    BTC: <FaBitcoin className="text-yellow-400" />,
    ETH: <FaEthereum className="text-blue-400" />,
    USDT: <span className="font-bold text-green-400">₮</span>,
};

const WalletPage = () => {
    const [modal, setModal] = useState({ type: null, asset: null });

    const { data: balancesResponse, isLoading: balancesLoading, error: balancesError } = useQuery({ queryKey: ['walletBalances'], queryFn: fetchWalletBalances });
    const { data: transactionsResponse, isLoading: transactionsLoading, error: transactionsError } = useQuery({ queryKey: ['transactions'], queryFn: fetchTransactions });

    const handleModalOpen = (type, asset = null) => setModal({ type, asset });
    const handleModalClose = () => setModal({ type: null, asset: null });

    const totalPortfolioValue = balancesResponse?.data.reduce((sum, wallet) => {
        const price = wallet.asset === 'BTC' ? 60000 : wallet.asset === 'ETH' ? 3000 : 1;
        return sum + (parseFloat(wallet.balance) * price);
    }, 0) || 0;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-light-heading dark:text-white flex items-center"><FaWallet className="mr-3 text-accent" />Custodial Wallet</h1>
                    <p className="text-light-muted dark:text-light-gray mt-1">Total Estimated Value: <span className="font-bold text-light-text dark:text-white">${totalPortfolioValue.toFixed(2)}</span></p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => handleModalOpen('deposit', 'BTC')}><FaArrowDown className="mr-2" /> Deposit</Button>
                    <Button onClick={() => handleModalOpen('swap')} variant="secondary"><FaRandom className="mr-2" /> Swap</Button>
                </div>
            </div>

            {balancesError && <Alert type="error" message={balancesError.response?.data?.detail || 'Failed to load balances.'} className="mb-6"/>}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-2">
                    <h2 className="text-xl font-semibold text-light-heading dark:text-white mb-4">Your Balances</h2>
                    {balancesLoading && <div className="flex justify-center p-8"><Spinner /></div>}
                    <div className="space-y-3">
                        {(balancesResponse?.data || []).map(wallet => (
                            <div key={wallet.asset} className="flex items-center justify-between p-3 bg-light-primary dark:bg-primary rounded-md">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{assetIcons[wallet.asset] || '?'}</span>
                                    <div>
                                        <p className="font-bold text-light-text dark:text-white">{wallet.asset}</p>
                                        <p className="font-mono text-light-muted dark:text-light-gray text-sm">{parseFloat(wallet.balance).toFixed(8)}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => handleModalOpen('deposit', wallet.asset)}><FaArrowDown /></Button>
                                    <Button size="sm" variant="secondary" disabled title="Coming Soon"><FaArrowUp /></Button>
                                </div>
                            </div>
                        ))}
                        {!balancesLoading && balancesResponse?.data.length === 0 && <p className="text-center text-light-muted dark:text-light-gray p-4">No funds in wallet. Click "Deposit" to get started.</p>}
                    </div>
                </Card>

                <Card className="lg:col-span-3">
                    <h2 className="text-xl font-semibold text-light-heading dark:text-white mb-4">Transaction History</h2>
                    {transactionsLoading && <div className="flex justify-center p-8"><Spinner /></div>}
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-sm text-left text-light-muted dark:text-light-gray">
                            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-light-secondary dark:bg-primary/50">
                                <tr>
                                    <th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Asset</th>
                                    <th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-light-border dark:divide-border-color">
                                {transactionsResponse?.data.map(tx => (
                                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-secondary">
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</td>
                                        <td className="px-4 py-3 font-semibold capitalize">{tx.type.toLowerCase()}</td>
                                        <td className="px-4 py-3 font-bold text-light-text dark:text-white">{tx.asset}</td>
                                        <td className={`px-4 py-3 text-right font-mono ${parseFloat(tx.amount) > 0 ? 'text-success' : 'text-danger'}`}>{parseFloat(tx.amount) > 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(8)}</td>
                                        <td className="px-4 py-3 text-xs">{tx.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                         {!transactionsLoading && transactionsResponse?.data.length === 0 && <p className="text-center text-light-muted dark:text-light-gray p-8">No transactions yet.</p>}
                    </div>
                </Card>
            </div>

            <DepositModal isOpen={modal.type === 'deposit'} onClose={handleModalClose} asset={modal.asset} />
            <SwapModal isOpen={modal.type === 'swap'} onClose={handleModalClose} balances={balancesResponse?.data || []} />
        </div>
    );
};
export default WalletPage;