// src/components/superuser/UsersTable.js

import React, { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { impersonateUser } from '../../api/apiService';
import { FaUserSecret, FaEdit, FaTrash } from 'react-icons/fa';
import Input from '../common/Input';
import Button from '../common/Button';
import toast from 'react-hot-toast';

const UsersTable = ({ users, onEdit, onDelete, onPromote }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const impersonateMutation = useMutation({
        mutationFn: impersonateUser,
        onSuccess: (data) => {
            toast.success('Impersonation successful. Redirecting...');
            // Store the new token and force a reload to log in as the user
            localStorage.setItem('accessToken', data.data.access_token);
            window.location.href = '/dashboard';
        },
        onError: (err) => toast.error(`Impersonation failed: ${err.message}`),
    });

    const filteredUsers = useMemo(() =>
        users.filter(user =>
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        ), [users, searchTerm]
    );

    return (
        <div>
            <div className="mb-4">
                <Input
                    placeholder="Search by user email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm text-left text-light-gray">
                    <thead className="text-xs text-gray-400 uppercase bg-primary sticky top-0">
                        <tr>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Plan</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Joined On</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-secondary">
                                <td className="px-4 py-3 font-semibold text-white">{user.email}</td>
                                <td className="px-4 py-3 capitalize">{user.subscription_plan}</td>
                                <td className="px-4 py-3 capitalize">{user.role}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{new Date(user.created_at).toLocaleDateString()}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center space-x-2">
                                        <Button size="sm" onClick={() => impersonateMutation.mutate(user.id)} title="Impersonate User">
                                            <FaUserSecret />
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => onEdit(user)} title="Edit User Plan">
                                            <FaEdit />
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => onDelete(user)} title="Delete User">
                                            <FaTrash />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UsersTable;