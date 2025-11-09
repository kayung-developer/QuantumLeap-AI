// src/components/layout/Sidebar.js

import React, { Fragment } from 'react'; // <-- Make sure Fragment is also imported from React
import { NavLink } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react'; // <-- THIS IS THE CRITICAL IMPORT

import {
    FaTachometerAlt,
    FaRobot,
    FaFlask,
    FaWallet,
    FaChartLine,
    FaKey,
    FaCreditCard,
    FaSignOutAlt,
    FaProjectDiagram,
    FaUserShield, // <-- Renamed from FaShieldAlt for consistency
    FaPlug,
    FaCogs,
    FaStore,
    FaBook
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const AppLogo = () => (
    <div className="flex items-center space-x-2 px-4 mb-10">
        {/* Make sure you have an app.png in your /public folder */}
        <img src="/app.png" alt="QuantumLeap Logo" className="h-8 w-8" />
        <span className="text-light-heading dark:text-white text-xl font-bold">QuantumLeap</span>
    </div>
);


const NavigationContent = () => {
    const { profile, logout } = useAuth();

    const navItems = [
        { label: 'Dashboard', path: '/dashboard', icon: <FaTachometerAlt />, end: true },
        { label: 'My Bots', path: '/dashboard/bots', icon: <FaRobot /> },
        { label: 'Wallet', path: '/dashboard/wallet', icon: <FaWallet /> },
        { label: 'Strategy Lab', path: '/dashboard/strategy-lab', icon: <FaFlask /> },
        { label: 'Strategy Builder', path: '/dashboard/builder', icon: <FaProjectDiagram /> },
        { label: 'Marketplace', path: '/dashboard/marketplace', icon: <FaStore /> },
        { label: 'Integrations', path: '/dashboard/integrations', icon: <FaPlug /> },
        { label: 'API Keys', path: '/dashboard/api-keys', icon: <FaKey /> },
        { label: 'Billing', path: '/dashboard/billing', icon: <FaCreditCard /> },
        { label: 'Trade History', path: '/dashboard/history', icon: <FaBook /> },
        { label: 'Settings', path: '/dashboard/settings', icon: <FaCogs /> },
    ];
    const adminNav = { label: 'Admin Panel', path: '/dashboard/admin', icon: <FaUserShield /> };

    const baseLinkClass = "flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors duration-200";
    const inactiveLinkClass = "text-light-muted hover:bg-light-hover hover:text-light-heading dark:text-light-gray dark:hover:bg-primary dark:hover:text-white";
    const activeLinkClass = "bg-accent/10 text-accent dark:bg-accent dark:text-white font-semibold shadow-md";

    return (
        <div className="bg-light-secondary dark:bg-secondary p-4 flex flex-col h-full border-r border-light-border dark:border-border-color">
            <AppLogo />
            <nav className="flex-grow">
                <ul>
                    {navItems.map(item => (
                        <li key={item.label}>
                            <NavLink to={item.path} end={item.end} className={({ isActive }) => `${baseLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}>
                                {item.icon}<span>{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                    {profile?.role === 'superuser' && (
                        <li>
                            <NavLink to={adminNav.path} className={({ isActive }) => `${baseLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}>
                                {adminNav.icon}<span>{adminNav.label}</span>
                            </NavLink>
                        </li>
                    )}
                </ul>
            </nav>
            <div className="flex-shrink-0">
                <button onClick={logout} className={`${baseLinkClass} ${inactiveLinkClass} w-full`}>
                    <FaSignOutAlt /><span>Logout</span>
                </button>
            </div>
        </div>
    );
};


const Sidebar = ({ isOpen, onClose }) => {
    return (
        <>
            {/* Mobile Sidebar (Overlay) */}
            <Transition.Root show={isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose}>
                    {/* ... (Transition.Child for overlay) ... */}
                    <div className="fixed inset-0 flex">
                        <Transition.Child as={Fragment} enter="transition ease-in-out duration-300 transform" enterFrom="-translate-x-full" enterTo="translate-x-0" leave="transition ease-in-out duration-300 transform" leaveFrom="translate-x-0" leaveTo="-translate-x-full">
                            <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                                {/* ... (Close button) ... */}
                                <NavigationContent />
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </Dialog>
            </Transition.Root>

            {/* Desktop Sidebar (Static) */}
            <div className="hidden lg:flex lg:flex-shrink-0">
                <div className="w-64">
                    <NavigationContent />
                </div>
            </div>
        </>
    );
};

export default Sidebar;