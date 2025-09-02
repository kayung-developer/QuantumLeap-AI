// src/components/profile/SecuritySettingsTab.js

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import Input from '../common/Input';
import Card from '../common/Card';
import toast from 'react-hot-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../api/firebase';
import { FaDesktop, FaMapMarkerAlt } from 'react-icons/fa';

const SecuritySettingsTab = ({ userProfile }) => {
    const [loading, setLoading] = useState(false);

    const handlePasswordReset = async () => {
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, userProfile.email);
            toast.success('Password reset email sent! Please check your inbox.');
        } catch (error) {
            toast.error(`Failed to send email: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Mock data for recent activity
    const recentActivity = [
        { device: 'Windows 10, Chrome', location: 'New York, USA', time: 'Now' },
        { device: 'iPhone 14 Pro', location: 'New York, USA', time: '2 hours ago' },
    ];

    return (
        <div className="space-y-8">
            {/* Change Password Section */}
            <div>
                <h3 className="text-xl font-bold text-white mb-2">Change Password</h3>
                <p className="text-sm text-light-gray mb-4">
                    For security, we will send a password reset link to your registered email address.
                </p>
                <Button onClick={handlePasswordReset} isLoading={loading}>
                    Send Password Reset Link
                </Button>
            </div>

            {/* Recent Activity Section */}
            <div className="border-t border-border-color pt-8">
                <h3 className="text-xl font-bold text-white mb-4">Recent Sign-in Activity</h3>
                <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-primary rounded-lg">
                            <div className="flex items-center">
                                <FaDesktop className="text-2xl text-accent mr-4" />
                                <div>
                                    <p className="font-semibold text-white">{activity.device}</p>
                                    <p className="text-sm text-light-gray flex items-center">
                                        <FaMapMarkerAlt className="mr-1.5" /> {activity.location}
                                    </p>
                                </div>
                            </div>
                            <p className="text-sm text-light-gray">{activity.time}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SecuritySettingsTab;