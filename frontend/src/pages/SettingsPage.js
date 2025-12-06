// src/pages/SettingsPage.js

import React, { useState } from 'react';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import ProfileSettingsTab from '../components/profile/ProfileSettingsTab';
import SecuritySettingsTab from '../components/profile/SecuritySettingsTab';
import AppearanceSettingsTab from '../components/settings/AppearanceSettingsTab';
import MT5IntegrationTab from '../components/profile/MT5IntegrationTab';
import MT5LoginTab from '../components/profile/MT5LoginTab'; // <-- 1. Import the new component
import { FaUserCircle, FaShieldAlt, FaPalette, FaKey, FaPlug, FaTerminal } from 'react-icons/fa';
//import { SiMetatrader5 } from 'react-icons/si'; // A good icon for MT5

// --- 2. Add the new tabs to the TABS array ---
const TABS = [
    { id: 'profile', name: 'Profile', icon: FaUserCircle },
    { id: 'security', name: 'Security & 2FA', icon: FaShieldAlt },
    //{ id: 'mt5Login', name: 'MT5 Account', icon: FaTerminal }, // Direct Login
    { id: 'mt5Api', name: 'MT5 Signal Keys', icon: FaKey },      // API Key / EA connection
    { id: 'appearance', name: 'Appearance', icon: FaPalette },
];

const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('profile');

    // This function can be simplified as it's not fetching data directly
    const renderTabContent = () => {
        switch (activeTab) {
            case 'profile': return <ProfileSettingsTab />;
            case 'security': return <SecuritySettingsTab />;
            case 'mt5Login': return <MT5LoginTab />;          // <-- 3. Add the render case
            case 'mt5Api': return <MT5IntegrationTab />;    // This was your previous MT5 tab for API keys
            case 'appearance': return <AppearanceSettingsTab />;
            default: return <Alert type="error" message="An unexpected error occurred." />;
        }
    };

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-light-heading dark:text-white">Settings</h1>
                <p className="text-light-muted dark:text-light-gray mt-1">Manage your profile, security, integrations, and application preferences.</p>
            </div>
            <Card>
                <div className="border-b border-light-border dark:border-border-color">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 py-3 px-1 text-sm font-semibold transition-colors whitespace-nowrap ${
                                    activeTab === tab.id
                                    ? 'border-b-2 border-accent text-accent'
                                    : 'border-b-2 border-transparent text-light-muted dark:text-light-gray hover:text-light-text dark:hover:text-white'
                                }`}
                            >
                                <tab.icon className="h-5 w-5" />
                                <span>{tab.name}</span>
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="pt-6">
                    {renderTabContent()}
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage;