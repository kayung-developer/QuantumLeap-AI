import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ReactPullToRefresh from 'react-pull-to-refresh';
import { FaSpinner } from 'react-icons/fa';
import toast from 'react-hot-toast';

// A custom loading component to show during the refresh
const LoadingSpinner = () => (
    <div className="flex justify-center items-center p-4">
        <FaSpinner className="animate-spin text-accent text-2xl" />
    </div>
);

const PullToRefresh = ({ children, onRefresh }) => {

     const handleRefresh = () => {
        // --- THIS IS THE FIX ---
        // The onRefresh prop now expects a function that returns a Promise.
        // We wrap our synchronous trigger in a Promise.
        return new Promise((resolve) => {
            if (onRefresh) {
                onRefresh();
            }
            // We resolve immediately. Our app's state (isRefreshing) will handle the visuals.
            // We are no longer waiting for the API calls to finish here.
            resolve();
        });
    };

    return (
        <ReactPullToRefresh
            onRefresh={handleRefresh}
            loading={<LoadingSpinner />}
            className="flex-grow"
            style={{
                textAlign: 'center',
                width: '100%',
                height: '100%',
                overflowY: 'auto'
            }}
            resistance={2}
        >
            {children}
        </ReactPullToRefresh>
    );
};

export default PullToRefresh;