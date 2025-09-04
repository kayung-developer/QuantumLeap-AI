import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef(null);
    const { isAuthenticated, accessToken } = useAuth();

    useEffect(() => {
        const accessToken = localStorage.getItem('accessToken');

       if (isAuthenticated && accessToken && (!ws.current || ws.current.readyState === WebSocket.CLOSED)) {
            const socketUrl = `${process.env.REACT_APP_WEBSOCKET_URL_BASE}/${accessToken}`;
            ws.current = new WebSocket(socketUrl);

            ws.current.onopen = () => {
                console.log("WebSocket Connected");
                setIsConnected(true);
            };

            ws.current.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log("WebSocket Message:", message);
                setMessages(prevMessages => [message, ...prevMessages.slice(0, 99)]); // Keep last 100 messages

                // Trigger Toasts for user feedback
                if (message.type === 'trade_executed') {
                    toast.success(`Trade Executed: ${message.details.side.toUpperCase()} ${message.details.symbol}`);
                } else if (message.type === 'error' && message.bot_id) {
                    toast.error(`Bot Error (${message.bot_id.slice(0, 8)}...): ${message.message}`);
                } else if (message.type === 'subscription_update') {
                    toast.success(`Plan updated to ${message.profile.subscription_plan}!`);
                }
            }; // The onmessage function now correctly ends here

            ws.current.onerror = (error) => {
                console.error("WebSocket Error:", error);
            };

            ws.current.onclose = () => {
                console.log("WebSocket Disconnected");
                setIsConnected(false);
                // Optional: Implement reconnect logic here
            };
        } else if (!isAuthenticated && ws.current) {
            // Disconnect
            ws.current.close();
            ws.current = null;
        }

        // Cleanup on component unmount
        return () => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.close();
            }
        };
    }, [isAuthenticated, accessToken]);

    // NEW function to send messages to the backend
    const sendMessage = (message) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(message));
        } else {
            console.error("Cannot send message, WebSocket is not open.");
        }
    };

    const value = {
        messages,
        isConnected,
        sendMessage, // Expose the new function
    };


    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};