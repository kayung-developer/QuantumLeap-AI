// src/components/layout/RightSidebar.js

import React, { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSuperuserNotifications, fetchUserBots, getWalletBalances } from '../../api/apiService';
import { Tab } from '@headlessui/react';
import {
    FaCog, FaSignOutAlt, FaBell, FaUserCircle, FaShieldAlt, FaUserPlus,
    FaExclamationCircle, FaRobot, FaWallet, FaCheckCircle, FaTimesCircle
} from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import Spinner from '../common/Spinner';

// --- Helper function to format class names for Headless UI tabs ---
function classNames(...classes) {
    return classes.filter(Boolean).join(' ');
}

// --- Reusable Notification Item Component ---
const NotificationItem = ({ notification }) => {
    const icons = {
        new_user: <FaUserPlus className="text-success" />,
        bot_error: <FaExclamationCircle className="text-danger" />,
        payment_success: <FaCheckCircle className="text-success" />,
        default: <FaBell className="text-accent" />
    };
    return (
        <div className="p-3 bg-light-main dark:bg-primary rounded-md flex items-start space-x-3">
            <div className="mt-1 flex-shrink-0">{icons[notification.type] || icons.default}</div>
            <div>
                <p className="text-sm text-gray-800 dark:text-light-gray font-medium">{notification.message}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{new Date(notification.created_at).toLocaleString()}</p>
            </div>
        </div>
    );
};

// --- Reusable Recent Activity Item Component ---
const ActivityItem = ({ bot }) => {
    const statusIcon = bot.is_active
        ? <FaCheckCircle className="text-success" />
        : <FaTimesCircle className="text-danger" />;
    return (
        <Link to={`/dashboard/bots/${bot.id}`} className="p-3 bg-white dark:bg-primary border border-gray-200 dark:border-transparent rounded-lg flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-border-color transition-colors">
            <div className="flex-shrink-0">{statusIcon}</div>
            <div className="flex-grow min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{bot.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{bot.strategy_name.replace(/_/g, ' ')}</p>
            </div>
        </Link>
    );
};

// --- Reusable Wallet Balance Item Component ---
const WalletItem = ({ wallet }) => (
    <div className="p-3 bg-white dark:bg-primary border border-gray-200 dark:border-transparent rounded-lg flex items-center justify-between">
        <div className="flex items-center">
            <FaWallet className="mr-3 text-accent" />
            <div>
                <p className="font-bold text-gray-900 dark:text-white">{wallet.asset}</p>
                <p className="text-xs text-gray-500">Balance</p>
            </div>
        </div>
        <p className="font-mono font-medium text-gray-800 dark:text-light-gray">{parseFloat(wallet.balance).toFixed(6)}</p>
    </div>
);


const RightSidebar = ({ isOpen, onClose }) => {
    const { profile, logout } = useAuth();
    const navigate = useNavigate();
    const isSuperuser = profile?.role === 'superuser';

    // --- Efficient Data Fetching: Only enabled when the sidebar is open ---
    const { data: notificationsResponse, isLoading: notificationsLoading } = useQuery({
        queryKey: ['superuserNotifications'],
        queryFn: fetchSuperuserNotifications,
        enabled: isSuperuser && isOpen,
        refetchInterval: 60000,
    });

    const { data: botsResponse, isLoading: botsLoading } = useQuery({
        queryKey: ['userBots'],
        queryFn: fetchUserBots,
        enabled: isOpen,
    });

    const { data: walletResponse, isLoading: walletLoading } = useQuery({
        queryKey: ['walletBalances'],
        queryFn: getWalletBalances,
        enabled: isOpen,
    });

    const notifications = notificationsResponse?.data || [];
    const recentBots = botsResponse?.data?.slice(0, 5) || []; // Show latest 5 bots
    const walletBalances = walletResponse?.data?.slice(0, 5) || []; // Show top 5 balances

    const handleLogout = () => {
        logout();
        onClose();
        navigate('/login');
    };

    const getAvatar = () => {
        if (profile?.profile?.profile_picture_url) {
            return <img src={profile.profile.profile_picture_url} alt="Profile" className="h-16 w-16 rounded-full" />;
        }
        return <FaUserCircle className="h-16 w-16 text-light-muted dark:text-light-gray" />;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black bg-opacity-60 z-40"
                    />

                    {/* Sidebar Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
                        className="fixed top-0 right-0 h-full w-full max-w-sm bg-light-secondary dark:bg-secondary border-l border-light-border dark:border-border-color shadow-lg z-50 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-border-color flex-shrink-0">
                            <h2 className="text-xl font-bold text-light-heading dark:text-white">User Panel</h2>
                            <button onClick={onClose} className="text-light-muted dark:text-light-gray hover:text-white">
                                <IoClose size={24} />
                            </button>
                        </div>

                        {/* Tabbed Interface for Content */}
                        <div className="flex-grow overflow-y-auto">
                            <Tab.Group>
                                <Tab.List className="flex space-x-1 rounded-xl bg-light-main dark:bg-primary p-1 m-4">
                                    <Tab className={({ selected }) => classNames('w-full rounded-lg py-2.5 text-sm font-medium leading-5', 'focus:outline-none ring-white/60 ring-offset-2 ring-offset-accent focus:ring-2', selected ? 'bg-accent text-white shadow' : 'text-light-muted dark:text-blue-100 hover:bg-white/[0.12] hover:text-white')}>
                                        My Activity
                                    </Tab>
                                    <Tab className={({ selected }) => classNames('w-full rounded-lg py-2.5 text-sm font-medium leading-5', 'focus:outline-none ring-white/60 ring-offset-2 ring-offset-accent focus:ring-2', selected ? 'bg-accent text-white shadow' : 'text-light-muted dark:text-blue-100 hover:bg-white/[0.12] hover:text-white')}>
                                        Account
                                    </Tab>
                                    {isSuperuser && (
                                        <Tab className={({ selected }) => classNames('w-full rounded-lg py-2.5 text-sm font-medium leading-5', 'focus:outline-none ring-white/60 ring-offset-2 ring-offset-accent focus:ring-2', selected ? 'bg-accent text-white shadow' : 'text-light-muted dark:text-blue-100 hover:bg-white/[0.12] hover:text-white')}>
                                            System
                                        </Tab>
                                    )}
                                </Tab.List>
                                <Tab.Panels className="p-4 pt-0">
                                    <Tab.Panel className="space-y-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white mb-2">Recent Bots</h3>
                                            {botsLoading ? <Spinner /> : recentBots.length > 0 ? (
                                                <div className="space-y-2">{recentBots.map(bot => <ActivityItem key={bot.id} bot={bot} />)}</div>
                                            ) : <p className="text-sm text-light-muted">No bots created yet.</p>}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white mt-6 mb-2">Top Balances</h3>
                                            {walletLoading ? <Spinner /> : walletBalances.length > 0 ? (
                                                <div className="space-y-2">{walletBalances.map(w => <WalletItem key={w.asset} wallet={w} />)}</div>
                                            ) : <p className="text-sm text-light-muted">No balances found.</p>}
                                        </div>
                                    </Tab.Panel>
                                    <Tab.Panel className="space-y-4">
                                         <Link to="/dashboard/settings" onClick={onClose} className="group flex items-center w-full px-4 py-3 text-md text-light-text dark:text-light-gray rounded-md hover:bg-light-hover dark:hover:bg-primary hover:text-white">
                                            <FaCog className="mr-4 h-5 w-5" /> Account Settings
                                        </Link>
                                        <Link to="/dashboard/billing" onClick={onClose} className="group flex items-center w-full px-4 py-3 text-md text-light-text dark:text-light-gray rounded-md hover:bg-light-hover dark:hover:bg-primary hover:text-white">
                                            <FaCreditCard className="mr-4 h-5 w-5" /> Billing & Subscription
                                        </Link>
                                        <button onClick={handleLogout} className="group flex items-center w-full px-4 py-3 text-md text-danger rounded-md hover:bg-primary">
                                            <FaSignOutAlt className="mr-4 h-5 w-5" /> Sign Out
                                        </button>
                                    </Tab.Panel>
                                    {isSuperuser && (
                                        <Tab.Panel className="space-y-4">
                                             <Link to="/dashboard/admin" onClick={onClose} className="group flex items-center w-full px-4 py-3 text-md text-accent rounded-md hover:bg-primary hover:text-white">
                                                <FaShieldAlt className="mr-4 h-5 w-5" /> Superuser Dashboard
                                            </Link>
                                            <h3 className="text-lg font-semibold text-white pt-4">System Notifications</h3>
                                            {notificationsLoading ? <Spinner /> : notifications.length > 0 ? (
                                                notifications.map(notif => <NotificationItem key={notif.id} notification={notif} />)
                                            ) : <p className="text-sm text-light-muted">No system notifications.</p>}
                                        </Tab.Panel>
                                    )}
                                </Tab.Panels>
                            </Tab.Group>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default RightSidebar;