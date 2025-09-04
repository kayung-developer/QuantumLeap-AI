// src/hooks/useApiMutation.js (NEW FILE)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

/**
 * A custom hook that wraps React Query's useMutation to provide
 * automatic success/error toast notifications and query invalidation.
 *
 * @param {Function} mutationFn The async function that performs the mutation (e.g., apiService.startBot).
 * @param {Object} options Configuration options.
 * @param {string} options.successMessage The message to show on success.
 * @param {Array<string>} options.invalidateQueries An array of query keys to invalidate on success.
 */
export const useApiMutation = (mutationFn, { successMessage = 'Operation successful!', invalidateQueries = [] }) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn,
        onSuccess: (data) => {
            // Show a success toast
            toast.success(successMessage);

            // Invalidate all specified queries to refetch data and update the UI
            if (invalidateQueries.length > 0) {
                invalidateQueries.forEach(queryKey => {
                    queryClient.invalidateQueries({ queryKey: [queryKey] });
                });
            }
        },
        onError: (error) => {
            // Extract a user-friendly error message from the API response
            const errorMessage = error.response?.data?.detail || error.message || 'An unexpected error occurred.';
            toast.error(errorMessage);
        },
    });
};