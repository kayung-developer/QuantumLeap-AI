import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getMT5Credentials, saveMT5Credentials, testMT5Connection } from '../api/apiService'; // We will add these
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { FaKey, FaTrash, FaPlug } from 'react-icons/fa';
import mt5Logo from '../assets/mt5-logo.png'; // You'll need to add an MT5 logo to your assets folder
import { useApiMutation } from '../hooks/useApiMutation';

const IntegrationsPage = () => {
    const queryClient = useQueryClient();
    const [credentials, setCredentials] = useState({ account_number: '', password: '', server: '' });

    // Fetch existing MT5 credentials
    const { data: mt5Data, isLoading: isLoadingCreds } = useQuery({
        queryKey: ['mt5Credentials'],
        queryFn: getMT5Credentials,
    });

    // Mutation for saving credentials
    const saveMutation = useApiMutation(saveMT5Credentials, {
        successMessage: "MT5 credentials saved successfully!",
        invalidateQueries: ['mt5Credentials'],
        onSuccess: () => {
            setCredentials({ account_number: '', password: '', server: '' }); // Clear form
        }
    });

    // Mutation for testing the connection
    const testMutation = useApiMutation(testMT5Connection, {
        onSuccess: (data) => {
            // Display a detailed success message
            toast.success(
                `Connection successful!\nBalance: ${data.data.details.balance} ${data.data.details.currency}`,
                { duration: 6000 }
            );
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
        if (mt5Data?.data?.[0]) {
            // We test with the SAVED credentials for security, not the form state.
            // The backend needs the password, which we don't have here.
            // So we'll test with what's in the form. A real-world scenario might
            // require re-entering the password to test. For simplicity, we'll use the form.
            if (!credentials.account_number || !credentials.password || !credentials.server) {
                toast.error("Please fill in all fields to test the connection.");
                return;
            }
            testMutation.mutate(credentials);
        } else {
            toast.error("Please save credentials before testing the connection.");
        }
    };

    const existingCreds = mt5Data?.data?.[0];

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Integrations</h1>
            <Card>
                <div className="flex items-center mb-6">
                    <img src={mt5Logo} alt="MetaTrader 5" className="h-10 w-10 mr-4" />
                    <div>
                        <h2 className="text-xl font-semibold text-white">MetaTrader 5 Connection</h2>
                        <p className="text-sm text-light-gray">Connect your MT5 account to allow QuantumLeap bots to trade on your behalf.</p>
                    </div>
                </div>

                {isLoadingCreds ? <Spinner /> : (
                    existingCreds ? (
                        <div className="bg-primary p-4 rounded-md mb-6">
                            <p className="font-semibold text-white">Active Connection:</p>
                            <p className="text-light-gray">Account: <span className="font-mono">{existingCreds.account_number}</span></p>
                            <p className="text-light-gray">Server: <span className="font-mono">{existingCreds.server}</span></p>
                            <p className="text-xs text-success mt-2">Credentials are saved and encrypted.</p>
                        </div>
                    ) : (
                         <p className="text-center text-light-gray mb-4">No MT5 account connected.</p>
                    )
                )}

                <form onSubmit={handleSave} className="space-y-4">
                    <h3 className="text-lg font-semibold border-b border-border-color pb-2">{existingCreds ? 'Update Credentials' : 'Add New Credentials'}</h3>
                    <Input
                        name="account_number"
                        type="number"
                        placeholder="MT5 Account Number"
                        value={credentials.account_number}
                        onChange={handleInputChange}
                        required
                    />
                    <Input
                        name="password"
                        type="password"
                        placeholder="MT5 Password"
                        value={credentials.password}
                        onChange={handleInputChange}
                        required
                    />
                    <Input
                        name="server"
                        placeholder="Broker Server Name"
                        value={credentials.server}
                        onChange={handleInputChange}
                        required
                    />
                    <div className="flex space-x-4 pt-4">
                        <Button type="submit" isLoading={saveMutation.isLoading} className="flex-1">
                            <FaKey className="mr-2" /> {existingCreds ? 'Update' : 'Save'} Credentials
                        </Button>
                        <Button type="button" variant="secondary" onClick={handleTestConnection} isLoading={testMutation.isLoading} className="flex-1">
                            <FaPlug className="mr-2" /> Test Connection
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default IntegrationsPage;