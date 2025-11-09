import React, { useState, useRef, useEffect } from 'react';
import { useApiMutation } from '../../hooks/useApiMutation';
import { getStrategySenseiResponse } from '../../api/apiService';
import { FaPaperPlane, FaRobot } from 'react-icons/fa';
import Button from '../common/Button';
import { motion, AnimatePresence } from 'framer-motion';

const StrategySenseiChat = () => {
    const [history, setHistory] = useState([]);
    const [input, setInput] = useState('');
    const chatEndRef = useRef(null);

    const chatMutation = useApiMutation(
        ({ message, history }) => getStrategySenseiResponse(message, history),
        {
            onSuccess: (data) => {
                setHistory(prev => [...prev, { role: 'model', content: data.data.response }]);
            }
        }
    );

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim() || chatMutation.isLoading) return;

        const userMessage = { role: 'user', content: input };
        const newHistory = [...history, userMessage];
        setHistory(newHistory);
        chatMutation.mutate({ message: input, history: history });
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-light-main dark:bg-primary rounded-lg border border-light-border dark:border-border-color">
            <div className="p-4 border-b border-light-border dark:border-border-color flex items-center">
                <FaRobot className="text-accent mr-3 text-xl" />
                <h3 className="font-semibold text-light-heading dark:text-white">Strategy Sensei</h3>
            </div>
            <div className="flex-grow p-4 overflow-y-auto">
                <AnimatePresence>
                    {history.map((msg, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg ${
                                msg.role === 'user'
                                ? 'bg-accent text-white'
                                : 'bg-light-secondary dark:bg-secondary'
                            }`}>
                                <p className="text-sm">{msg.content}</p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                 {chatMutation.isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="p-3 rounded-lg bg-light-secondary dark:bg-secondary text-sm">Typing...</div>
                    </motion.div>
                )}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-light-border dark:border-border-color flex items-center">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask for a strategy..."
                    className="flex-grow bg-light-secondary dark:bg-secondary p-2 rounded-l-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <Button type="submit" className="rounded-l-none" isLoading={chatMutation.isLoading}>
                    <FaPaperPlane />
                </Button>
            </form>
        </div>
    );
};

export default StrategySenseiChat;