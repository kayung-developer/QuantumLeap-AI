import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaTachometerAlt, FaRobot, FaFlask, FaWallet, FaChartLine, FaKey, FaCreditCard, FaSignOutAlt, FaProjectDiagram } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const AppLogo = () => (
    <div className="flex items-center space-x-2 px-4 mb-10">
        <img src="/app.png" alt="QuantumLeap Logo" className="h-8 w-8" />
        <span className="text-light-heading dark:text-white text-xl font-bold">QuantumLeap</span>
    </div>
);

const Sidebar = () => {
    const { logout } = useAuth();
    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: <FaTachometerAlt />, end: true },
        { name: 'My Bots', path: '/dashboard/bots', icon: <FaRobot /> },
        { name: 'Wallet', path: '/dashboard/wallet', icon: <FaWallet /> },
        { name: 'Strategy Lab', path: '/dashboard/strategy-lab', icon: <FaFlask /> },
        { name: 'Strategy Builder', path: '/dashboard/builder', icon: <FaProjectDiagram /> },
        { name: 'Marketplace', path: '/dashboard/marketplace', icon: <FaChartLine /> },
        { name: 'API Keys', path: '/dashboard/api-keys', icon: <FaKey /> },
        { name: 'Billing', path: '/dashboard/billing', icon: <FaCreditCard /> },
    ];
    const baseLinkClass = "flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors duration-200";
    const inactiveLinkClass = "text-light-muted hover:bg-gray-200 hover:text-light-text dark:text-light-gray dark:hover:bg-primary dark:hover:text-white";
    const activeLinkClass = "bg-accent/10 text-accent dark:bg-accent dark:text-white font-semibold";

    return (
        <aside className="w-64 bg-light-secondary dark:bg-secondary p-4 flex-shrink-0 flex flex-col border-r border-light-border dark:border-border-color">
            <AppLogo />
            <nav className="flex-grow">
                <ul>
                    {navItems.map(item => (
                        <li key={item.name}>
                            <NavLink to={item.path} end={item.end} className={({ isActive }) => `${baseLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}>
                                {item.icon}
                                <span>{item.name}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="flex-shrink-0">
                <button onClick={logout} className={`${baseLinkClass} ${inactiveLinkClass} w-full`}>
                    <FaSignOutAlt />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;