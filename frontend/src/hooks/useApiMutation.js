import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// This is the custom hook you are using.
// The change is adding `= {}` to the options parameter.
export const useApiMutation = (mutationFn, options = {}) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn,
        onSuccess: (data) => {
            // Now, `options` will always be an object, even if it's empty.
            // This check will no longer crash.
            if (options.successMessage) {
                toast.success(options.successMessage);
            }

            if (options.invalidateQueries) {
                // Invalidate all specified queries to refetch data
                options.invalidateQueries.forEach(queryKey => {
                    queryClient.invalidateQueries({ queryKey: [queryKey] });
                });
            }

            // You can also add a generic onSuccess callback if needed
            if (options.onSuccess) {
                options.onSuccess(data);
            }
        },
        onError: (error) => {
            // A robust error handler for all mutations
            const errorMessage = error.response?.data?.detail || error.message || "An unexpected error occurred.";
            toast.error(errorMessage);

            if (options.onError) {
                options.onError(error);
            }
        },
    });
};