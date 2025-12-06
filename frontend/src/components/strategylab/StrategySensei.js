// src/components/strategylab/StrategySensei.js

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { sendMessageToSensei, addUserMessage } from '../../store/senseiSlice';
import Button from '../common/Button';
import Textarea from '../common/TextAreaChat';
import Spinner from '../common/Spinner';
import { FaBrain, FaPaperPlane } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const ChatMessage = ({ message }) => {
    const isUser = message.role === 'user';
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex my-2 ${isUser ? 'justify-end' : 'justify-start'}`}
        >
            <div className={`p-3 rounded-lg max-w-xs md:max-w-md shadow-sm 
                ${isUser 
                    ? 'bg-accent text-white' // User: Blue
                    : 'bg-gray-100 text-gray-900 border border-gray-200 dark:bg-secondary dark:text-gray-200 dark:border-border-color' // AI: White/Gray
                }`}>
                <p className="text-sm whitespace-pre-wrap font-medium">{message.content}</p>
            </div>
        </motion.div>
    );
};

const extractJsonConfig = (text) => {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonRegex);
    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (error) {
            console.error("Failed to parse JSON from Sensei response:", error);
            return null;
        }
    }
    return null;
};

const StrategySensei = ({ onStrategySuggested }) => {
    const dispatch = useDispatch();

    // --- STATE IS NOW 100% FROM REDUX ---
    const { messages, status } = useSelector((state) => state.sensei);
    const isLoading = status === 'loading';

    // Local state is only for the controlled input field
    const [inputValue, setInputValue] = useState('');
    const chatEndRef = useRef(null);

    // Using useCallback to prevent this from being recreated on every render
    const memoizedOnStrategySuggested = useCallback(onStrategySuggested, []);

    useEffect(() => {
        // This effect runs when the messages array in Redux changes
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
            const config = extractJsonConfig(lastMessage.content);
            if (config) {
                // If a JSON config is found, notify the parent page
                if (config.strategy_name === 'error') {
                    memoizedOnStrategySuggested({ error: config.explanation });
                } else {
                    memoizedOnStrategySuggested(config);
                }
            }
        }
    }, [messages, memoizedOnStrategySuggested]);

    // Auto-scroll effect
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        // 1. Dispatch the user's message to the Redux store immediately for a snappy UI
        dispatch(addUserMessage(inputValue));

        // 2. Prepare the chat history for the backend (excluding the initial greeting)
        const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));

        // 3. Dispatch the async thunk to get the AI's response and update the store
        dispatch(sendMessageToSensei({ text: inputValue, history }));

        setInputValue('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };


    return (
        <div className="bg-light-primary dark:bg-primary border border-light-border dark:border-border-color p-4 rounded-lg flex flex-col h-[70vh]">
            <h3 className="text-xl font-bold text-light-heading dark:text-white mb-4 flex items-center flex-shrink-0">
                <FaBrain className="mr-3 text-accent" /> Strategy Sensei
            </h3>

            <div className="flex-grow overflow-y-auto pr-2 mb-4">
                <AnimatePresence>
                    {messages.map((msg, index) => <ChatMessage key={index} message={msg} />)}
                </AnimatePresence>
                {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="p-3 rounded-lg bg-light-secondary dark:bg-secondary">
                            <Spinner size="sm" />
                        </div>
                    </motion.div>
                )}
                <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex-shrink-0 relative">
                <Textarea
                    placeholder="Describe your strategy or ask a question..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full !p-4 !pr-14 !h-24 resize-none"
                    disabled={isLoading}
                />
                <Button
                  type="submit"
                  isLoading={isLoading}
                  className="!absolute bottom-3 right-3 !p-2 !rounded-md"
                  title="Send Message"
                >
                    <FaPaperPlane />
                </Button>
            </form>
        </div>
    );
};

export default StrategySensei;
