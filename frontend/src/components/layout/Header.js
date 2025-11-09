// src/components/layout/Header.js

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, Transition } from '@headlessui/react';
import { FaBell, FaUserCircle, FaSignOutAlt, FaBars } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import LivePriceTicker from '../dashboard/LivePriceTicker';
import RightSidebar from './RightSidebar';
import MarketStatusIndicator from '../common/MarketStatusIndicator';

const Header = () => {
    const { profile, logout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const getAvatar = () => {
        if (profile?.profile?.profile_picture_url) {
            return <img src={profile.profile.profile_picture_url} alt="Profile" className="h-9 w-9 rounded-full" />;
        }
        return <FaUserCircle className="h-9 w-9 text-light-muted dark:text-light-gray" />;
    };

    return (
        <>
            <header className="flex-shrink-0 bg-light-secondary dark:bg-secondary border-b border-light-border dark:border-border-color">
                {/* --- THIS IS THE MODIFIED CONTAINER --- */}
                {/* It now uses Flexbox to align its children horizontally and center them vertically */}
                <div className="flex items-center justify-between p-4 min-w-0">
                    <div className="flex items-center space-x-4 min-w-0">
                        {/* 2. ADD THE INDICATOR HERE */}
                        <div className="hidden sm:block">
                            <MarketStatusIndicator />
                        </div>
                    {/* --- Ticker Container (Left Side) --- */}
                    {/* 'min-w-0' is a crucial class that allows the ticker to shrink */}
                    <div className="hidden lg:flex items-center min-w-0">
                        <LivePriceTicker />
                    </div>
                    </div>

                    {/* --- Spacer (this will push the right-side controls to the end) --- */}
                    <div className="flex-grow"></div>

                    {/* --- Controls Container (Right Side) --- */}
                    {/* 'flex-shrink-0' ensures these controls don't get squished */}
                    <div className="flex items-center space-x-4 md:space-x-6 flex-shrink-0 ml-4">
                        <button className="relative text-light-muted dark:text-light-gray hover:text-light-text dark:hover:text-white transition-colors">
                            <FaBell className="h-6 w-6" />
                            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-accent ring-2 ring-light-secondary dark:ring-secondary" />
                        </button>

                        <div className="hidden sm:block text-right">
                            <p className="text-light-text dark:text-white font-semibold truncate max-w-[150px]">{profile?.email}</p>
                            <p className="text-xs text-accent uppercase">{profile?.subscription_plan} Plan</p>
                        </div>

                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-light-gray hover:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                            <FaBars className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </header>

            {/* The sidebar remains unchanged, its state is controlled from here */}
            <RightSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </>
    );
};

export default Header;