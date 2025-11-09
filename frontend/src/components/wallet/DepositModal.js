// src/components/wallet/DepositModal.js

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDepositAddress } from '../../api/apiService';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';
import Alert from '../common/Alert';
import Button from '../common/Button';
import toast from 'react-hot-toast';

const DepositModal = ({ isOpen, onClose, asset }) => {
    const { data: depositInfo, isLoading, isError, error } = useQuery({
        queryKey: ['depositAddress', asset],
        queryFn: () => getDepositAddress(asset),
        enabled: isOpen && !!asset, // Only fetch when the modal is open and an asset is selected
        staleTime: Infinity, // The address doesn't change, so no need to refetch
        refetchOnWindowFocus: false,
    });

    const handleCopy = (text, fieldName) => {
        navigator.clipboard.writeText(text);
        toast.success(`${fieldName} copied to clipboard!`);
    };

    return (
        <Modal title={`Deposit ${asset}`} isOpen={isOpen} onClose={onClose}>
            {isLoading && <div className="flex justify-center p-8"><Spinner /></div>}
            {isError && <Alert type="error" message={error.response?.data?.detail || 'Failed to generate deposit address.'} />}
            {depositInfo && (
                <div className="space-y-4 text-center">
                    <Alert type="warning" message={`Only send ${asset} to this address. Sending any other asset may result in the permanent loss of your funds.`} />
                    <div>
                        <p className="font-semibold text-white mt-4">Your Unique {asset} Address</p>
                        <div className="mt-2 p-3 bg-primary border border-border-color rounded-md font-mono text-accent break-all">
                            {depositInfo.data.address}
                        </div>
                        <Button variant="secondary" className="mt-2 w-full" onClick={() => handleCopy(depositInfo.data.address, 'Address')}>
                            Copy Address
                        </Button>
                    </div>

                    {depositInfo.data.memo && (
                         <div>
                            <p className="font-semibold text-white mt-4">Deposit Memo / Tag</p>
                            <div className="mt-2 p-3 bg-primary border border-border-color rounded-md font-mono text-accent break-all">
                                {depositInfo.data.memo}
                            </div>
                            <Button variant="secondary" className="mt-2 w-full" onClick={() => handleCopy(depositInfo.data.memo, 'Memo')}>
                                Copy Memo
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default DepositModal;