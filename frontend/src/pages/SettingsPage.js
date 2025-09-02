// src/pages/SettingsPage.js

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFullUserProfile } from '../api/apiService';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import ProfileSettingsTab from '../components/profile/ProfileSettingsTab';
import SecuritySettingsTab from '../components/profile/SecuritySettingsTab';
import ApiKeysTab from '../components/profile/ApiKeysTab';
import AppearanceSettingsTab from '../components/settings/AppearanceSettingsTab'; // New
import { FaUserCircle, FaShieldAlt, FaKey, FaPalette } from 'react-icons/fa';

const TABS = [
    { id: 'profile', name: 'Profile', icon: FaUserCircle },
    { id: 'security', name: 'Security', icon: FaShieldAlt },
    { id: 'apiKeys', name: 'API Keys', icon: FaKey },
    { id: 'appearance', name: 'Appearance', icon: FaPalette },
];

const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('profile');

    const { data: userProfileResponse, isLoading, error } = useQuery({
        queryKey: ['fullUserProfile'],
        queryFn: fetchFullUserProfile,
        staleTime: 5 * 60 * 1000,
    });

    const renderTabContent = () => {
        // Show a single loading spinner for the user data
        if (isLoading) {
            return <div className="flex justify-center p-16"><Spinner size="lg" /></div>;
        }
        if (error) {
            return <Alert type="error" message={`Failed to load user data: ${error.message}`} />;
        }

        const userProfile = userProfileResponse?.data;

        // Render content based on the active tab
        switch (activeTab) {
            case 'profile':
                return <ProfileSettingsTab userProfile={userProfile} />;
            case 'security':
                return <SecuritySettingsTab userProfile={userProfile} />;
            case 'apiKeys':
                return <ApiKeysTab />; // This tab fetches its own data
            case 'appearance':
                return <AppearanceSettingsTab />;
            default:
                return null;
        }
    };

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Settings</h1>
                <p className="text-light-gray mt-1">Manage your profile, security, and application preferences.</p>
            </div>

            <Card>
                {/* --- Tab Navigation --- */}
                <div className="border-b border-border-color">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 py-3 px-1 text-sm font-semibold transition-colors whitespace-nowrap
                                    ${activeTab === tab.id
                                        ? 'border-b-2 border-accent text-accent'
                                        : 'border-b-2 border-transparent text-light-gray hover:text-white'
                                    }`
                                }
                            >
                                <tab.icon />
                                <span>{tab.name}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* --- Tab Content --- */}
                <div className="pt-6">
                    {renderTabContent()}
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage;