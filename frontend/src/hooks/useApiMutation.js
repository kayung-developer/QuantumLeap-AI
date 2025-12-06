import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// Helper to safely extract error messages from various formats (String, Array, Object)
const getErrorMessage = (error) => {
    if (!error) return "An unexpected error occurred.";
    
    // Check for Backend/Axios response details
    const detail = error.response?.data?.detail;
    
    if (detail) {
        // Handle Pydantic Validation Errors (Array of objects)
        if (Array.isArray(detail)) {
            return detail.map(err => {
                // Format: "field_name: Error message"
                const field = err.loc && err.loc.length > 1 ? err.loc[err.loc.length - 1] : 'Field';
                return `${field}: ${err.msg}`;
            }).join('\n');
        }
        // Handle generic object errors
        if (typeof detail === 'object') {
            return JSON.stringify(detail);
        }
        // Handle string errors
        return String(detail);
    }

    // Fallback to standard error message
    return error.message || String(error);
};

export const useApiMutation = (mutationFn, options = {}) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn,
        onSuccess: (data) => {
            if (options.successMessage) {
                toast.success(options.successMessage);
            }

            if (options.invalidateQueries) {
                options.invalidateQueries.forEach(queryKey => {
                    queryClient.invalidateQueries({ queryKey: [queryKey] });
                });
            }

            if (options.onSuccess) {
                options.onSuccess(data);
            }
        },
        onError: (error) => {
            // FIX: Use the helper to get a safe string
            const errorMessage = getErrorMessage(error);
            toast.error(errorMessage);

            if (options.onError) {
                options.onError(error);
            }
        },
    });
};