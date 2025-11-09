import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// Component Imports
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import LineProgressBar from '../common/LineProgressBar'; // We are keeping this

const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const queryClient = useQueryClient();

    // The refresh function is now very simple. It just invalidates queries.
    // The progress bar will automatically appear because `useIsFetching` will become > 0.
    const handleRefresh = () => {
        toast.promise(
            queryClient.invalidateQueries(),
            {
                loading: 'Refreshing data...',
                success: <b>Data refreshed!</b>,
                error: <b>Failed to refresh data.</b>,
            }
        );
    };

    // The keyboard shortcut logic remains simple and correct.
    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                handleRefresh();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []); // Empty dependency array is correct here.

    return (
        <div className="flex h-screen bg-light-main dark:bg-primary text-light-text dark:text-light-gray overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col overflow-hidden relative"> {/* `relative` is important */}
                <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

                {/* Just place the self-contained progress bar here. No props needed. */}
                <LineProgressBar />

                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;