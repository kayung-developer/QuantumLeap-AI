import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSystemStats, fetchAllUsers, triggerEmergencyKillSwitch, changeUserPlan, deleteUser, createUserByAdmin, updateUserByAdmin } from '../api/apiService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import StatCard from '../components/dashboard/StatCard';
import UsersTable from '../components/superuser/UsersTable';
import { FaUsers, FaRobot, FaPowerOff, FaExclamationTriangle, FaPlus } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Input from '../components/common/Input'; // We'll need this for forms
import SerialManager from '../components/superuser/SerialManager';

const SuperuserDashboard = () => {
    const queryClient = useQueryClient();
    const [modal, setModal] = useState({ type: null, user: null, data: {} });

    const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['systemStats'], queryFn: fetchSystemStats });
    const { data: usersResponse, isLoading: usersLoading } = useQuery({ queryKey: ['allUsers'], queryFn: fetchAllUsers });

    const mutationOptions = {
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allUsers'] });
            queryClient.invalidateQueries({ queryKey: ['systemStats'] });
            setModal({ type: null, user: null, data: {} });
        },
        onError: (err) => toast.error(`Error: ${err.response?.data?.detail || err.message}`),
    };

    const killSwitchMutation = useMutation({ mutationFn: triggerEmergencyKillSwitch, onSuccess: () => { toast.success('Kill Switch activated!'); setModal({ type: null }); }, onError: mutationOptions.onError });
    const deleteUserMutation = useMutation({ mutationFn: deleteUser, onSuccess: () => { toast.success('User deleted.'); mutationOptions.onSuccess(); } });
    const createUserMutation = useMutation({ mutationFn: createUserByAdmin, onSuccess: () => { toast.success('User created.'); mutationOptions.onSuccess(); } });
    const updateUserMutation = useMutation({ mutationFn: ({ userId, data }) => updateUserByAdmin(userId, data), onSuccess: () => { toast.success('User updated.'); mutationOptions.onSuccess(); } });

    const handleModalInputChange = (e) => setModal(prev => ({ ...prev, data: { ...prev.data, [e.target.name]: e.target.value } }));

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                {/* Header: Black */}
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Superuser Dashboard</h1>
                <Button onClick={() => setModal({ type: 'create' })}><FaPlus className="mr-2" />Create User</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <Card className="lg:col-span-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">User Management</h2>
                    {usersLoading ? <Spinner/> : <UsersTable users={usersResponse?.data || []} onEdit={(user) => setModal({ type: 'edit', user: user, data: user })} onDelete={(user) => setModal({ type: 'delete', user: user })} />}
                </Card>
                
                {/* Emergency Card: Red background needs white text always */}
                <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                     <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-4 flex items-center"><FaExclamationTriangle className="mr-2"/>Emergency Controls</h2>
                     <p className="text-sm text-red-600 dark:text-red-200 mb-6 font-medium">This will stop all running bots immediately. Use only in a critical system-wide emergency.</p>
                     <Button variant="danger" className="w-full shadow-red-200 dark:shadow-none" onClick={() => setModal({ type: 'kill_switch' })}>Activate Kill Switch</Button>
                </Card>
            </div>
            <div className="mt-6">
                <SerialManager />
            </div>

            {/* --- MODALS --- */}
            {modal.type === 'create' && (
                <Modal title="Create New User" isOpen={true} onClose={() => setModal({ type: null })}>
                    <form onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(modal.data); }} className="space-y-4">
                        <Input label="Email" name="email" type="email" onChange={handleModalInputChange} required />
                        <Input label="Password" name="password" type="password" onChange={handleModalInputChange} required />
                        <Button type="submit" isLoading={createUserMutation.isLoading} className="w-full">Create User</Button>
                    </form>
                </Modal>
            )}
            {modal.type === 'edit' && (
                 <Modal title={`Edit ${modal.user.email}`} isOpen={true} onClose={() => setModal({ type: null })}>
                    <form onSubmit={(e) => { e.preventDefault(); updateUserMutation.mutate({ userId: modal.user.id, data: modal.data }); }} className="space-y-4">
                        <Input label="First Name" name="first_name" defaultValue={modal.user.profile?.first_name} onChange={handleModalInputChange} />
                        <Input label="Last Name" name="last_name" defaultValue={modal.user.profile?.last_name} onChange={handleModalInputChange} />
                        <div>
                            <label className="block text-sm">Plan</label>
                            <select name="subscription_plan" defaultValue={modal.user.subscription_plan} onChange={handleModalInputChange} className="w-full p-2 bg-primary rounded">
                                <option value="basic">Basic</option><option value="premium">Premium</option><option value="ultimate">Ultimate</option>
                            </select>
                        </div>
                        <Button type="submit" isLoading={updateUserMutation.isLoading} className="w-full">Save Changes</Button>
                    </form>
                </Modal>
            )}
            {modal.type === 'delete' && (
                 <Modal title="Confirm User Deletion" isOpen={true} onClose={() => setModal({ type: null })}>
                    <div className="text-center">
                        <FaExclamationTriangle className="mx-auto text-5xl text-danger mb-4" />
                        <h3 className="text-lg font-bold text-white">Are you absolutely sure?</h3>
                        <p className="text-sm text-light-gray mt-2">This will permanently delete the user <strong className="text-white">{modal.user.email}</strong>. This action is irreversible.</p>
                        <div className="mt-6 flex justify-center gap-4">
                            <Button variant="secondary" onClick={() => setModal({ type: null })}>Cancel</Button>
                            <Button variant="danger" onClick={() => deleteUserMutation.mutate(modal.user.id)} isLoading={deleteUserMutation.isLoading}>Yes, Delete User</Button>
                        </div>
                    </div>
                 </Modal>
            )}
            {modal.type === 'kill_switch' && (
                 <Modal title="Confirm Kill Switch" isOpen={true} onClose={() => setModal({ type: null })}>
                    <div className="text-center">
                        <FaExclamationTriangle className="mx-auto text-5xl text-danger mb-4" />
                        <h3 className="text-lg font-bold text-white">Activate Emergency Kill Switch?</h3>
                        <p className="text-sm text-light-gray mt-2">This will immediately stop every active bot on the platform.</p>
                        <div className="mt-6 flex justify-center gap-4">
                            <Button variant="secondary" onClick={() => setModal({ type: null })}>Cancel</Button>
                            <Button variant="danger" onClick={() => killSwitchMutation.mutate()} isLoading={killSwitchMutation.isLoading}>Yes, Activate</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SuperuserDashboard;