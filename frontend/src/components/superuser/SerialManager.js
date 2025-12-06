import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAllUsers, fetchAllSerialNumbers, generateSerialNumber, deleteSerialNumber } from '../../api/apiService';
import { useApiMutation } from '../../hooks/useApiMutation';
import toast from 'react-hot-toast';
import Card from '../common/Card';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import { FaKey, FaPlus, FaClipboard, FaTrash } from 'react-icons/fa';

const SerialManager = () => {
    const queryClient = useQueryClient();
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedPlan, setSelectedPlan] = useState('ultimate');

    // Fetch all users to populate the dropdown
    const { data: usersResponse, isLoading: usersLoading } = useQuery({
        queryKey: ['allUsers'],
        queryFn: fetchAllUsers
    });

    // Fetch all existing serial numbers
    const { data: serialsResponse, isLoading: serialsLoading } = useQuery({
        queryKey: ['allSerials'],
        queryFn: fetchAllSerialNumbers
    });

    // Mutation for generating a new serial key
    const generateMutation = useApiMutation(
        () => generateSerialNumber(selectedUserId, selectedPlan), {
        onSuccess: () => {
            toast.success("New serial number generated successfully!");
            queryClient.invalidateQueries({ queryKey: ['allSerials'] });
        }
    });
    // --- NEW: Mutation for deleting a serial key ---
    const deleteMutation = useApiMutation(deleteSerialNumber, {
        successMessage: "Serial number deleted successfully!",
        invalidateQueries: ['allSerials'], // Refresh the list after deletion
    });

    const handleDelete = (serialId) => {
        // Add a confirmation dialog for a better UX
        if (window.confirm("Are you sure you want to permanently delete this serial key? This action cannot be undone.")) {
            deleteMutation.mutate(serialId);
        }
    };


    const handleGenerate = () => {
        if (!selectedUserId) {
            toast.error("Please select a user to assign the key to.");
            return;
        }
        generateMutation.mutate();
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Serial key copied to clipboard!");
    };

    const users = usersResponse?.data || [];
    const serials = serialsResponse?.data || [];
    const isLoading = usersLoading || serialsLoading;

    return (
        <Card>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Serial Number Management</h2>

            {/* --- Generation Form --- */}
            <div className="bg-gray-50 dark:bg-primary p-5 rounded-xl border border-gray-200 dark:border-border-color mb-8 grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Assign to User</label>
                    <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        // FIX: Explicitly set Black text on White bg for Light Mode
                        className="w-full p-2.5 bg-white dark:bg-secondary border border-gray-300 dark:border-border-color rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none"
                        disabled={usersLoading}
                    >
                        <option value="" disabled>Select a user...</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>{user.email}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">For Plan</label>
                    <select
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-secondary border border-gray-300 dark:border-border-color rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-accent outline-none"
                    >
                        <option value="ultimate">Ultimate</option>
                        <option value="premium">Premium</option>
                    </select>
                </div>
                <Button onClick={handleGenerate} isLoading={generateMutation.isLoading} className="h-[42px]">
                    <FaPlus className="mr-2" /> Generate Key
                </Button>
            </div>

            {/* --- List of Existing Serials --- */}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Generated Keys</h3>
            {isLoading ? <Spinner /> : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {serials.length > 0 ? serials.map(serial => {
                        const userEmail = users.find(u => u.id === serial.assigned_user_id)?.email || 'Unknown User';
                        
                        return (
                            <div key={serial.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-primary rounded-lg border border-gray-200 dark:border-border-color gap-3 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex-grow min-w-0">
                                    <p 
                                        className="font-mono text-lg font-bold text-accent break-all select-all cursor-pointer hover:text-blue-700 dark:hover:text-blue-400 transition-colors" 
                                        title="Click to copy"
                                        onClick={() => copyToClipboard(serial.serial_key)}
                                    >
                                        {serial.serial_key}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                        Assigned to: <span className="text-gray-900 dark:text-white font-bold">{userEmail}</span> • Plan: <span className="uppercase font-bold text-gray-700 dark:text-gray-300">{serial.associated_plan}</span>
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2 flex-shrink-0 self-start sm:self-center">
                                    {serial.machine_id_hash ? (
                                        <span className="text-xs font-bold text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30 px-3 py-1 rounded-full border border-green-200 dark:border-transparent">ACTIVATED</span>
                                    ) : (
                                        <span className="text-xs font-bold text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30 px-3 py-1 rounded-full border border-yellow-200 dark:border-transparent">UNCLAIMED</span>
                                    )}
                                    <Button variant="secondary" size="sm" onClick={() => copyToClipboard(serial.serial_key)} title="Copy">
                                        <FaClipboard />
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDelete(serial.id)} title="Delete">
                                        <FaTrash />
                                    </Button>
                                </div>
                            </div>
                        );
                    }) : <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">No serial numbers have been generated yet.</p>}
                </div>
            )}
        </Card>
    );
};

export default SerialManager;