// src/components/profile/ProfileSettingsTab.js

import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { updateUserProfile, uploadProfilePicture } from '../../api/apiService';
import { useAuth } from '../../contexts/AuthContext'; // 1. Import the useAuth hook
import Button from '../common/Button';
import Input from '../common/Input';
import toast from 'react-hot-toast';
import { FaUserCircle } from 'react-icons/fa';

const ProfileSettingsTab = () => {
    // 2. Get profile and the refetch function directly from the context
    const { profile, refetchProfile } = useAuth();

    // 3. Initialize react-hook-form with default values from the profile
    const { register, handleSubmit, formState: { errors } } = useForm({
        defaultValues: {
            first_name: profile?.profile?.first_name || '',
            last_name: profile?.profile?.last_name || '',
            country: profile?.profile?.country || '',
            phone_number: profile?.profile?.phone_number || '',
        }
    });

    const updateProfileMutation = useMutation({
        mutationFn: updateUserProfile,
        onSuccess: () => {
            toast.success('Profile updated successfully!');
            refetchProfile(); // 4. Refetch the global profile state on success
        },
        onError: (error) => toast.error(`Update failed: ${error.response?.data?.detail || error.message}`),
    });

    const uploadPictureMutation = useMutation({
        mutationFn: uploadProfilePicture,
        onSuccess: () => {
            toast.success('Profile picture updated successfully!');
            refetchProfile(); // 4. Refetch the global profile state on success
        },
        onError: (error) => toast.error(`Upload failed: ${error.response?.data?.detail || error.message}`),
    });

    // This function now receives data directly from react-hook-form
    const onProfileSubmit = (data) => {
        updateProfileMutation.mutate(data);
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            uploadPictureMutation.mutate(formData);
        }
    };

    const getAvatar = () => {
        if (profile?.profile?.profile_picture_url) {
            // Add a timestamp to the URL to break the browser cache after a new upload
            const bustCacheUrl = `${profile.profile.profile_picture_url}?t=${new Date().getTime()}`;
            return <img src={bustCacheUrl} alt="Profile" className="w-32 h-32 rounded-full border-4 border-accent object-cover" />;
        }
        return <FaUserCircle className="w-32 h-32 rounded-full text-light-secondary dark:text-secondary" />;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Avatar Section */}
            <div className="lg:col-span-1 flex flex-col items-center text-center">
                {getAvatar()}
                <h3 className="text-xl font-bold text-light-heading dark:text-white mt-4">{profile?.profile?.first_name || profile?.email}</h3>
                <p className="text-sm text-light-muted dark:text-light-gray capitalize">{profile?.subscription_plan} Plan</p>

                <div className="mt-6 w-full space-y-2">
                    <input type="file" id="file-upload" onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden"/>
                    <Button
                        onClick={() => document.getElementById('file-upload').click()}
                        isLoading={uploadPictureMutation.isLoading}
                        className="w-full"
                        variant="secondary"
                    >
                        Change Picture
                    </Button>
                     <p className="text-xs text-light-muted dark:text-light-gray">PNG or JPG, up to 2MB.</p>
                </div>
            </div>

            {/* Form Section */}
            <form onSubmit={handleSubmit(onProfileSubmit)} className="lg:col-span-2 space-y-4">
                <Input label="Email Address" defaultValue={profile?.email || ''} disabled className="!bg-gray-100 dark:!bg-primary/50" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="First Name" {...register("first_name")} error={errors.first_name} />
                    <Input label="Last Name" {...register("last_name")} error={errors.last_name} />
                </div>
                <Input label="Country" {...register("country")} error={errors.country} />
                <Input label="Phone Number" {...register("phone_number")} error={errors.phone_number} />
                <div className="pt-2">
                    <Button type="submit" isLoading={updateProfileMutation.isLoading}>Save Changes</Button>
                </div>
            </form>
        </div>
    );
};

export default ProfileSettingsTab;
