import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getMT5Credentials, saveMT5Credentials, testMT5Connection } from '../api/apiService';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { FaKey, FaPlug, FaCheckCircle } from 'react-icons/fa';
import mt5Logo from '../assets/mt5-logo.png'; // Ensure you have this image or remove the img tag
import { useApiMutation } from '../hooks/useApiMutation';

const IntegrationsPage = () => {
    const queryClient = useQueryClient();
    const [credentials, setCredentials] = useState({ account_number: '', password: '', server: '' });

    // Fetch existing MT5 credentials
    const { data: mt5Data, isLoading: isLoadingCreds } = useQuery({
        queryKey: ['mt5Credentials'],
        queryFn: getMT5Credentials,
        onSuccess: (data) => {
            if (data?.data && data.data.length > 0) {
                const creds = data.data[0];
                // Pre-fill form (password will remain empty for security)
                setCredentials(prev => ({ 
                    ...prev, 
                    account_number: creds.account_number, 
                    server: creds.server 
                }));
            }
        }
    });

    // Mutation for saving credentials
    const saveMutation = useApiMutation(saveMT5Credentials, {
        successMessage: "MT5 credentials saved successfully!",
        invalidateQueries: ['mt5Credentials'],
        // Don't clear form on update, only on new save if desired
    });

    // Mutation for testing the connection
    const testMutation = useApiMutation(testMT5Connection, {
        onSuccess: (data) => {
            // --- FIX: Robust data checking before access ---
            const details = data?.data?.details;
            if (details && details.balance !== undefined) {
                toast.success(
                    `Connection successful!\nBalance: ${details.balance} ${details.currency}`,
                    { duration: 5000 }
                );
            } else {
                toast.success("Connection successful! (No balance data returned)");
            }
        }
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        saveMutation.mutate(credentials);
    };

    const handleTestConnection = () => {
        // We allow testing with the form data
        if (!credentials.account_number || !credentials.password || !credentials.server) {
            toast.error("Please fill in all fields (including password) to test the connection.");
            return;
        }
        testMutation.mutate(credentials);
    };

    const existingCreds = mt5Data?.data?.[0];

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Integrations</h1>
            <Card>
                <div className="flex items-center mb-6">
                    {/* Placeholder if logo missing, or ensure mt5Logo is imported correctly */}
                    <div className="h-10 w-10 mr-4 bg-white rounded-full flex items-center justify-center font-bold text-black">5</div>
                    <div>
                        <h2 className="text-xl font-semibold text-white">MetaTrader 5 Connection</h2>
                        <p className="text-sm text-light-gray">Connect your MT5 account to allow QuantumLeap bots to trade on your behalf.</p>
                    </div>
                </div>

                {isLoadingCreds ? <Spinner /> : (
                    existingCreds ? (
                        <div className="bg-white dark:bg-primary p-5 rounded-xl mb-6 border border-green-200 dark:border-border-color shadow-sm relative overflow-hidden">
                            {/* Decorative stripe */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-success"></div>
                            
                            <p className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Active Connection</p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs">Account</p>
                                    <p className="font-mono text-gray-800 dark:text-white font-medium">{existingCreds.account_number}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-xs">Server</p>
                                    <p className="font-mono text-gray-800 dark:text-white font-medium">{existingCreds.server}</p>
                                </div>
                            </div>
                            <p className="text-xs text-green-700 dark:text-success mt-4 flex items-center font-bold">
                                <FaCheckCircle className="mr-1.5" /> Credentials encrypted & secure.
                            </p>
                        </div>
                    ) : (
                         <p className="text-center text-light-gray mb-4">No MT5 account connected.</p>
                    )
                )}

                <form onSubmit={handleSave} className="space-y-4">
                    <h3 className="text-lg font-semibold text-white border-b border-border-color pb-2">
                        {existingCreds ? 'Update Connection Details' : 'Add New Connection'}
                    </h3>
                    
                    <Input
                        label="Account Number"
                        name="account_number"
                        type="number"
                        placeholder="e.g. 50123456"
                        value={credentials.account_number}
                        onChange={handleInputChange}
                        required
                    />
                    <Input
                        label="Password"
                        name="password"
                        type="password"
                        placeholder="MT5 Trading Password"
                        value={credentials.password}
                        onChange={handleInputChange}
                        required
                    />
                    <Input
                        label="Broker Server"
                        name="server"
                        placeholder="e.g. MetaQuotes-Demo"
                        value={credentials.server}
                        onChange={handleInputChange}
                        required
                    />
                    
                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                        <Button type="submit" isLoading={saveMutation.isLoading} className="flex-1">
                            {existingCreds ? 'Update Credentials' : 'Save Credentials'}
                        </Button>
                        <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={handleTestConnection} 
                            isLoading={testMutation.isLoading} 
                            className="flex-1"
                        >
                            <FaPlug className="mr-2" /> Test & Connect
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default IntegrationsPage;