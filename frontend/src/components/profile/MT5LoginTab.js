import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../hooks/useApiMutation';
import { getMT5Credentials, saveMT5Credentials, testMT5Connection } from '../../api/apiService'; // Add these to apiService.js
import Input from '../common/Input';
import Button from '../common/Button';
import Alert from '../common/Alert';
import Spinner from '../common/Spinner';

const MT5LoginTab = () => {
    const [accountNumber, setAccountNumber] = useState('');
    const [password, setPassword] = useState('');
    const [server, setServer] = useState('');
    const [credentials, setCredentials] = useState({ account_number: '', password: '', server: '' });

    const { data: creds, isLoading: isLoadingCreds } = useQuery({
        queryKey: ['mt5Credentials'],
        queryFn: getMT5Credentials,
        onSuccess: (data) => {
            if (data?.data) {
                setAccountNumber(data.data.account_number);
                setServer(data.data.server);
            }
        }
    });

    const saveMutation = useApiMutation(saveMT5Credentials, {
        successMessage: "MT5 credentials saved!",
        invalidateQueries: ['mt5Credentials'],
    });

    const testMutation = useApiMutation(testMT5Connection);

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate({
            account_number: parseInt(accountNumber),
            password: password,
            server: server,
        });
    };

    if (isLoadingCreds) {
        return <div className="flex justify-center"><Spinner /></div>;
    }

    return (
        <div>
            <h3 className="text-xl font-bold text-light-heading dark:text-white">Direct MT5 Account Login</h3>
            <p className="text-sm text-light-muted dark:text-light-gray mt-2 mb-6">
                Securely store your MT5 credentials to allow the platform to manage trades on your behalf. Credentials are encrypted at rest.
            </p>

            {creds?.data && !password && (
                <Alert type="info" message={`Credentials for account ${creds.data.account_number} are saved. To update, re-enter your password.`} />
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <Input label="MT5 Account Number" type="number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required />
                <Input label="MT5 Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password to save or update" required />
                <Input label="MT5 Server" type="text" value={server} onChange={e => setServer(e.target.value)} required />
                <div className="flex items-center space-x-4 pt-2">
                    <Button type="submit" isLoading={saveMutation.isLoading}>
                        Save Credentials
                    </Button>
                    {creds?.data && (
                        <Button type="button" variant="secondary" onClick={() => testMutation.mutate()} isLoading={testMutation.isLoading}>
                            Connect
                        </Button>
                    )}
                </div>
            </form>

            {testMutation.isSuccess && (
                <Alert type="success" className="mt-4">
                    <p className="font-bold">Connection Successful!</p>
                    <p>Account: {testMutation.data?.data?.account_name}</p>
                    <p>Balance: {testMutation.data?.data?.balance} {testMutation.data?.data?.currency}</p>
                </Alert>
            )}
        </div>
    );
};

export default MT5LoginTab;