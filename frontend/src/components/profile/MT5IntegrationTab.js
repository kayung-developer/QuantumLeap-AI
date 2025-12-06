import React, { useState, useEffect } from 'react';
import { fetchPlatformApiKeys, createPlatformApiKey } from '../../api/apiService';
import useApi from '../../hooks/useApi';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import { FaCopy } from 'react-icons/fa';
import toast from 'react-hot-toast';

const MT5IntegrationTab = () => {
    const { data: keys, loading, error, refetch } = useApi(fetchPlatformApiKeys);
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateKey = async () => {
        setIsCreating(true);
        try {
            await createPlatformApiKey();
            toast.success("New Platform API Key Created!");
            refetch();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to create key.");
        } finally {
            setIsCreating(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
    };

    const apiKey = keys?.[0]?.key; // Display the first available key

    return (
        <div>
            <h3 className="text-xl font-bold text-light-heading dark:text-white">MetaTrader 5 Integration</h3>
            <p className="text-sm text-light-muted dark:text-light-gray mt-2 mb-6">
                Connect your MT5 Expert Advisor (EA) to receive trade signals directly from your bots.
            </p>

            {loading && <div className="flex justify-center p-8"><Spinner /></div>}
            {error && <p className="text-danger">Failed to load API keys.</p>}

            {!loading && !apiKey && (
                 <div className="text-center p-8 border-2 border-dashed border-light-border dark:border-border-color rounded-lg">
                    <p className="mb-4">You don't have a Platform API Key yet.</p>
                    <Button onClick={handleCreateKey} isLoading={isCreating}>
                        Generate Your First Key
                    </Button>
                </div>
            )}

            {apiKey && (
                 <div className="space-y-6">
                    <div>
                        <label className="font-semibold">Your Platform API Key</label>
                        <div className="flex items-center mt-2 p-3 bg-light-secondary dark:bg-primary rounded-md border border-light-border dark:border-border-color">
                            <pre className="flex-grow text-sm font-mono text-accent"><code>{apiKey}</code></pre>
                            <button onClick={() => copyToClipboard(apiKey)} className="ml-4 text-light-muted dark:text-light-gray hover:text-light-text dark:hover:text-white">
                                <FaCopy />
                            </button>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">Setup Instructions</h4>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-light-text dark:text-gray-300">
                            <li>Download the QuantumLeap EA file from our documentation.</li>
                            <li>In your MT5 Terminal, go to `File` {'>'} `Open Data Folder`.</li>
                            <li>Place the EA file in the `MQL5/Experts` directory.</li>
                            <li>In the Navigator panel, right-click 'Expert Advisors' and click 'Refresh'.</li>
                            <li>Drag the QuantumLeap EA onto the chart of the asset you want to trade.</li>
                            <li>In the 'Inputs' tab, paste your Platform API Key and the Bot ID (from the bot's page).</li>
                            <li>Ensure 'Algo Trading' is enabled in the toolbar and click 'OK'.</li>
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MT5IntegrationTab;