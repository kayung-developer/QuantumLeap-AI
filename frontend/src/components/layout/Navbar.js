// src/components/layout/Navbar.js

import React, { useState, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, Transition } from '@headlessui/react';
import {
    FaBell,
    FaUserCircle,
    FaSignOutAlt,
    FaCog,
    FaWallet,
    FaSearch,
    FaBars // For mobile menu trigger
} from 'react-icons/fa';
import MarketStatusIndicator from '../common/MarketStatusIndicator';

// This is a new prop `onToggleSidebar` to control the mobile sidebar
const Navbar = ({ onToggleSidebar }) => {
    const { profile, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Helper to get user's initials or a default icon
    const getAvatar = () => {
        if (profile?.profile?.profile_picture_url) {
            return <img src={profile.profile.profile_picture_url} alt="Profile" className="h-9 w-9 rounded-full object-cover" />;
        }
        if (profile?.email) {
            return (
                <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-white font-bold">
                    {profile.email.substring(0, 1).toUpperCase()}
                </div>
            );
        }
        return <FaUserCircle className="h-9 w-9 text-light-gray" />;
    };

    return (
        <header className="flex-shrink-0 bg-light-secondary dark:bg-secondary border-b border-light-border dark:border-border-color z-30">
            <div className="flex items-center justify-between p-4">
                {/* --- Left Side: Mobile Menu Button & Market Status --- */}
                <div className="flex items-center space-x-4">
                    {/* Hamburger menu button for mobile */}
                    <button
                        onClick={onToggleSidebar}
                        className="lg:hidden text-light-muted dark:text-light-gray focus:outline-none"
                    >
                        <FaBars className="h-6 w-6" />
                    </button>
                    <MarketStatusIndicator />
                </div>

                {/* --- Center: Global Search Bar (for larger screens) ---
                <div className="hidden md:flex flex-1 max-w-lg mx-4">
                    <div className="relative w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FaSearch className="text-light-muted dark:text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search bots, strategies, symbols..."
                            className="w-full pl-10 pr-4 py-2 bg-light-main dark:bg-primary border border-light-border dark:border-border-color rounded-full focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                    </div>
                </div>
                */}
                {/* --- Right Side: Actions & User Profile --- */}
                <div className="flex items-center space-x-4 md:space-x-6">
                    <button className="relative text-light-muted dark:text-light-gray hover:text-light-text dark:hover:text-white transition-colors">
                        <FaBell className="h-6 w-6" />
                        {/* Notification dot */}
                        <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-light-secondary dark:ring-secondary" />
                    </button>

                    {/* Profile Dropdown Menu */}
                    <Menu as="div" className="relative">
                        <div>
                            <Menu.Button className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-accent">
                                <span className="sr-only">Open user menu</span>
                                {getAvatar()}
                            </Menu.Button>
                        </div>
                        <Transition
                            as={Fragment}
                            enter="transition ease-out duration-100"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                        >
                            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-light-secondary dark:bg-secondary divide-y divide-light-border dark:divide-border-color rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <div className="px-4 py-3">
                                    <p className="text-sm text-light-text dark:text-white">Signed in as</p>
                                    <p className="text-sm font-medium text-light-heading dark:text-white truncate">{profile?.email}</p>
                                </div>
                                <div className="py-1">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <Link to="/dashboard/wallet" className={`${active ? 'bg-light-hover dark:bg-primary' : ''} group flex items-center w-full px-4 py-2 text-sm text-light-text dark:text-light-gray`}>
                                                <FaWallet className="mr-3 h-5 w-5" />
                                                My Wallet
                                            </Link>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <Link to="/dashboard/settings" className={`${active ? 'bg-light-hover dark:bg-primary' : ''} group flex items-center w-full px-4 py-2 text-sm text-light-text dark:text-light-gray`}>
                                                <FaCog className="mr-3 h-5 w-5" />
                                                Settings
                                            </Link>
                                        )}
                                    </Menu.Item>
                                </div>
                                <div className="py-1">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button onClick={handleLogout} className={`${active ? 'bg-light-hover dark:bg-primary' : ''} group flex items-center w-full px-4 py-2 text-sm text-danger`}>
                                                <FaSignOutAlt className="mr-3 h-5 w-5" />
                                                Logout
                                            </button>
                                        )}
                                    </Menu.Item>
                                </div>
                            </Menu.Items>
                        </Transition>
                    </Menu>
                </div>
            </div>
        </header>
    );
};

export default Navbar;