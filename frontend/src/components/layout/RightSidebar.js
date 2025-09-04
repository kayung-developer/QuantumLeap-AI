// src/components/layout/RightSidebar.js

import React from 'react';
import { useQuery } from '@tanstack/react-query'; // --- NEW: For data fetching
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSuperuserNotifications } from '../../api/apiService';
// --- MODIFIED: Import the FaShieldAlt icon for the superuser link ---
import { FaCog, FaSignOutAlt, FaBell, FaUserCircle, FaShieldAlt, FaUserPlus, FaExclamationCircle } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import Spinner from '../common/Spinner';


// --- NEW: A helper component to format each notification type ---
const NotificationItem = ({ notification }) => {
    const icons = {
        new_user: <FaUserPlus className="text-success" />,
        bot_error: <FaExclamationCircle className="text-danger" />,
        default: <FaBell className="text-accent" />
    };

    return (
        <div className="p-3 bg-primary rounded-md flex items-start">
            <div className="mr-3 mt-1 flex-shrink-0">
                {icons[notification.type] || icons.default}
            </div>
            <div>
                <p className="text-sm text-light-gray">{notification.message}</p>
                <p className="text-xs text-light-muted">{new Date(notification.created_at).toLocaleString()}</p>
            </div>
        </div>
    );
};



const RightSidebar = ({ isOpen, onClose }) => {
    const { profile, logout } = useAuth();
    // --- NEW: Check if the current user has the 'superuser' role ---
    const isSuperuser = profile?.role === 'superuser';

    const { data: notificationsResponse, isLoading: notificationsLoading } = useQuery({
    queryKey: ['superuserNotifications'],
    queryFn: fetchSuperuserNotifications,
    enabled: isSuperuser && isOpen, // Only fetch when the sidebar is open and user is admin
    staleTime: 1000 * 60, // Refetch every minute
    });

    const notifications = notificationsResponse?.data || [];

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

                                {/* --- NEW: Conditionally rendered link for Superusers --- */}
                                {isSuperuser && (
                                    <Link to="/dashboard/superuser" onClick={onClose} className="group flex items-center w-full px-4 py-3 text-md text-accent rounded-md hover:bg-primary hover:text-white">
                                        <FaShieldAlt className="mr-4 h-5 w-5" /> Superuser Dashboard
                                    </Link>
                                )}

                                <button onClick={() => { logout(); onClose(); }} className="group flex items-center w-full px-4 py-3 text-md text-danger rounded-md hover:bg-primary">
                                    <FaSignOutAlt className="mr-4 h-5 w-5" /> Sign Out
                                </button>
                            </div>

                            {/* Notifications Section */}
                            {isSuperuser && (
                                <div className="mt-8">
                                    <h3 className="text-lg font-semibold text-white px-4 mb-2">System Notifications</h3>
                                    {notificationsLoading ? (
                                        <div className="flex justify-center p-8"><Spinner /></div>
                                    ) : (
                                        <div className="space-y-3">

                                            {notifications.length > 0 ? (
                                                notifications.map(notif => <NotificationItem key={notif.id} notification={notif} />)
                                            ) : (
                                                <p className="text-sm text-center text-light-muted p-4">No new system notifications.</p>
                                            )}
                                        </div>
                                    )}
                                 </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default RightSidebar;