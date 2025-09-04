// frontend/src/hooks/useWebSocketListener.js
import { useState, useEffect } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

/**
 * A custom hook to listen for specific WebSocket messages.
 * @param {Function} filterCondition - A function that takes a message and returns true if it should be included.
 * @returns {Array} An array of messages that match the filter condition.
 */
const useWebSocketListener = (filterCondition) => {
    const { messages } = useWebSocket();
    const [filteredMessages, setFilteredMessages] = useState([]);

    useEffect(() => {
        // When new messages arrive, filter them and update the local state.
        const newFilteredMessages = messages.filter(filterCondition);
        if (newFilteredMessages.length > 0) {
            // Prepend new messages to the existing filtered list
            setFilteredMessages(prev => [...newFilteredMessages, ...prev]);
        }
    }, [messages, filterCondition]);

    return filteredMessages;
};

export default useWebSocketListener;