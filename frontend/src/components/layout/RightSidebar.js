// src/components/layout/RightSidebar.js (NEW FILE)

import React, { Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FaCog, FaSignOutAlt, FaBell, FaUserCircle } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';

const RightSidebar = ({ isOpen, onClose }) => {
    const { profile, logout } = useAuth();

    const getAvatar = () => {
        if (profile?.profile?.profile_picture_url) {
            return <img src={profile.profile.profile_picture_url} alt="Profile" className="h-16 w-16 rounded-full" />;
        }
        return <FaUserCircle className="h-16 w-16 text-light-muted dark:text-light-gray" />;
    };

    // --- Mock notifications data ---
    const notifications = [
        { id: 1, type: 'trade', message: 'BTC/USDT buy order filled.', time: '2m ago' },
        { id: 2, type: 'status', message: 'Bot "ETH Scalper" has been stopped.', time: '1h ago' },
        { id: 3, type: 'alert', message: 'API key for Binance is expiring in 3 days.', time: '3h ago' },
    ];

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

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
                        className="fixed top-0 right-0 h-full w-full max-w-sm bg-secondary border-l border-border-color shadow-lg z-50 flex flex-col"
                    >
                        {/* Sidebar Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border-color flex-shrink-0">
                            <h2 className="text-xl font-bold text-white">Dashboard Menu</h2>
                            <button onClick={onClose} className="text-light-gray hover:text-white">
                                <IoClose size={24} />
                            </button>
                        </div>

                        {/* User Profile Section */}
                        <div className="flex flex-col items-center p-6 border-b border-border-color">
                            {getAvatar()}
                            <p className="mt-4 text-lg font-semibold text-white">{profile?.profile?.first_name || profile?.email}</p>
                            <p className="text-sm text-accent uppercase">{profile?.subscription_plan} Plan</p>
                        </div>

                        {/* Main Content (Scrollable) */}
                        <div className="flex-grow p-4 overflow-y-auto">
                            {/* Navigation Links */}
                            <div className="space-y-2">
                                <Link to="/dashboard/settings" onClick={onClose} className="group flex items-center w-full px-4 py-3 text-md text-light-gray rounded-md hover:bg-primary hover:text-white">
                                    <FaCog className="mr-4 h-5 w-5" /> Account Settings
                                </Link>
                                <button onClick={() => { logout(); onClose(); }} className="group flex items-center w-full px-4 py-3 text-md text-danger rounded-md hover:bg-primary">
                                    <FaSignOutAlt className="mr-4 h-5 w-5" /> Sign Out
                                </button>
                            </div>

                            {/* Notifications Section */}
                            <div className="mt-8">
                                <h3 className="text-lg font-semibold text-white px-4 mb-2">Notifications</h3>
                                <div className="space-y-3">
                                    {notifications.map(notif => (
                                        <div key={notif.id} className="p-3 bg-primary rounded-md flex items-start">
                                            <FaBell className="text-accent mr-3 mt-1 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm text-light-gray">{notif.message}</p>
                                                <p className="text-xs text-light-muted">{notif.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default RightSidebar;