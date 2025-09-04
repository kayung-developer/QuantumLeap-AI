// src/pages/ApiKeysPage.js

import React from 'react';
import ApiKeysTab from '../components/profile/ApiKeysTab'; // The component we already built
import { FaKey } from 'react-icons/fa';

const ApiKeysPage = () => {
    return (
        <div>
            <div className="mb-8">
                 <h1 className="text-3xl font-bold text-light-heading dark:text-white flex items-center">
                    <FaKey className="mr-3 text-accent" />
                    API Keys
                </h1>
                <p className="text-light-muted dark:text-light-gray mt-1">
                    Securely connect your exchange accounts to enable live trading for your bots.
                </p>
            </div>

            {/* We are reusing the component that contains all the functionality */}
            <ApiKeysTab />
        </div>
    );
};

export default ApiKeysPage;