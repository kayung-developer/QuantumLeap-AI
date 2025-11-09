import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { setupTwoFactor, verifyTwoFactor } from '../../api/apiService'; // Assume these are added to apiService.js
import { useApiMutation } from '../../hooks/useApiMutation';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Alert from '../common/Alert';
import toast from 'react-hot-toast';

const SecuritySettingsTab = () => {
    const { profile, refetchProfile } = useAuth();
    const [setupData, setSetupData] = useState(null);
    const [verificationCode, setVerificationCode] = useState('');

    const setupMutation = useApiMutation(setupTwoFactor, {
        onSuccess: (data) => {
            setSetupData(data.data);
        },
        successMessage: "2FA setup initiated. Scan the QR code."
    });

    const verifyMutation = useApiMutation(verifyTwoFactor, {
        onSuccess: () => {
            toast.success("2FA enabled successfully!");
            setSetupData(null);
            refetchProfile();
        },
    });

    const handleVerify = () => {
        verifyMutation.mutate({ token: verificationCode });
    };

    return (
        <div>
            <h3 className="text-xl font-bold text-light-heading dark:text-white">Two-Factor Authentication (2FA)</h3>
            {profile.is_otp_enabled ? (
                <Alert type="success" message="2FA is currently active on your account." className="mt-4" />
            ) : (
                <>
                    <p className="text-sm text-light-muted dark:text-light-gray mt-2 mb-4">
                        Add an extra layer of security to your account.
                    </p>
                    <Button onClick={() => setupMutation.mutate()} isLoading={setupMutation.isLoading}>
                        Enable 2FA
                    </Button>
                </>
            )}

            {setupData && (
                <Modal title="Set Up Two-Factor Authentication" isOpen={!!setupData} onClose={() => setSetupData(null)}>
                    <div className="text-center space-y-4">
                        <p>1. Scan this QR code with your authenticator app (e.g., Google Authenticator).</p>
                        <div dangerouslySetInnerHTML={{ __html: setupData.qr_code_svg }} className="bg-white p-4 inline-block rounded-lg" />
                        <p>2. Enter the 6-digit code from your app to verify.</p>
                        <Input
                            placeholder="123456"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            maxLength={6}
                        />
                        <Button onClick={handleVerify} isLoading={verifyMutation.isLoading} className="w-full">
                            Verify & Enable
                        </Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SecuritySettingsTab;