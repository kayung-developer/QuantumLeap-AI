import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPlatformApiKeys, createPlatformApiKey, deletePlatformApiKey } from '../../api/apiService';
import { FaKey, FaPlus, FaTrash } from 'react-icons/fa';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import Modal from '../common/Modal';
import Alert from '../common/Alert';

const PlatformApiKeysManager = () => {
    const queryClient = useQueryClient();
    const [newKey, setNewKey] = useState(null);

    const { data: keys, isLoading } = useQuery({ queryKey: ['platformApiKeys'], queryFn: fetchPlatformApiKeys });

    const createMutation = useMutation({
        mutationFn: createPlatformApiKey,
        onSuccess: (response) => {
            setNewKey(response.data);
            queryClient.invalidateQueries({ queryKey: ['platformApiKeys'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deletePlatformApiKey,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platformApiKeys'] })
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center"><FaKey className="mr-2" />Platform API Keys</h2>
                <p className="text-sm text-light-gray mb-4">
                Use these keys for programmatic access to your QuantumLeap account. Automate tasks, build custom integrations, or connect third-party applications. This feature is for advanced users.
                </p>
                <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isLoading}><FaPlus className="mr-2" />Generate Key</Button>
            </div>
            {isLoading ? <Spinner /> : (
                <div className="space-y-3">
                    {keys?.data.map(key => (
                        // UPDATE: High contrast background and text
                        <div key={key.id} className="flex items-center justify-between p-4 bg-white dark:bg-primary rounded-xl border border-gray-200 dark:border-border-color shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 dark:bg-secondary rounded-lg">
                                    <FaKey className="text-purple-500" />
                                </div>
                                {/* Key Prefix: Dark Mono */}
                                <p className="font-bold font-mono text-gray-800 dark:text-white text-lg">
                                    {key.key_prefix}****
                                </p>
                            </div>
                            <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(key.id)}>
                                <FaTrash />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Update the Modal Content */}
            <Modal title="New API Key Generated" isOpen={!!newKey} onClose={() => setNewKey(null)}>
                <Alert type="warning" message={newKey?.message} />
                {/* Key Display: High contrast box */}
                <div className="p-4 bg-gray-100 dark:bg-primary border-2 border-gray-300 dark:border-border-color rounded-lg font-mono text-lg text-purple-600 dark:text-accent break-all font-bold select-all text-center my-4">
                    {newKey?.full_key}
                </div>
            </Modal>
        </div>
    );
};

export default PlatformApiKeysManager;