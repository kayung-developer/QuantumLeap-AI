// src/hooks/useApi.js

import { useState, useEffect, useCallback } from 'react';

const useApi = (apiFunc, ...params) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiFunc(...params);
            setData(response.data);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [apiFunc, ...params]); // Use deep comparison for params if they are objects/arrays

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
};

export default useApi;