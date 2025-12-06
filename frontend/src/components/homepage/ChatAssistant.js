// src/components/homepage/ChatAssistant.js

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCommentDots, FaHeadset, FaPaperPlane, FaRobot } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
// --- MODIFIED: Import the new, correct API function ---
import { askChatAssistant, submitContactForm } from '../../api/apiService';
import toast from 'react-hot-toast';
import Spinner from '../common/Spinner';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Button from '../common/Button';

// The key change is that this line will now work correctly:
// const res = await askChatAssistant(inputValue, history);

// For completeness, here is the full file with the corrected import.

const ChatMessage = ({ msg }) => {
    const isAssistant = msg.role === 'assistant';
    const content = msg.content;
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex my-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
        >
            <div className={`p-3 rounded-lg max-w-xs md:max-w-md shadow-sm 
                ${isAssistant 
                    // Bot: Gray-100 background, Gray-900 text (High Contrast)
                    ? 'bg-gray-100 text-gray-900 border border-gray-200 dark:bg-primary dark:text-light-gray dark:border-border-color' 
                    // User: Accent background (unchanged)
                    : 'bg-accent text-white'
                }`}>
                <div className="text-sm whitespace-pre-wrap font-medium">{content}</div>
            </div>
        </motion.div>
    );
};

const ChatAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatMode, setChatMode] = useState('ai'); // 'ai' or 'human'

    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');

    const chatEndRef = useRef(null);

    useEffect(() => {
        const savedHistory = localStorage.getItem('chatHistory');
        if (savedHistory) {
            setMessages(JSON.parse(savedHistory));
        } else {
            setMessages([{ role: 'assistant', content: "Hello! I'm the QuantumLeap AI assistant. How can I help you today? Ask me about strategies, features, or pricing." }]);
        }
    }, []);

    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('chatHistory', JSON.stringify(messages));
        }
    }, [messages]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userMessage = { role: 'user', content: inputValue };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = inputValue;
        setInputValue('');

        const supportKeywords = ['human', 'admin', 'support', 'contact', 'agent', 'person'];
        if (supportKeywords.some(keyword => currentInput.toLowerCase().includes(keyword))) {
            setChatMode('human');
            const systemMessage = { role: 'assistant', content: "It looks like you want to speak with our support team. Please provide your details below, and we'll get back to you as soon as possible." };
            setMessages(prev => [...prev, systemMessage]);
            return;
        }

        setIsLoading(true);
        try {
            const history = messages.slice(-10);
            const res = await askChatAssistant(currentInput, history); // This now calls the public endpoint
            const assistantMessage = { role: 'assistant', content: res.data.response };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage = { role: 'assistant', content: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again in a moment." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        if (!userName.trim() || !userEmail.trim() || !inputValue.trim()) {
            return toast.error("Please fill in all fields.");
        }
        setIsLoading(true);
        try {
            await submitContactForm({ name: userName, email: userEmail, message: inputValue });
            toast.success("Your message has been sent! Our team will get back to you shortly.");
            const systemMessage = { role: 'assistant', content: "Thanks! Your message is on its way. I'm here if you have any other questions." };
            setMessages(prev => [...prev, {role: 'user', content: `Message sent to support by ${userName}`}, systemMessage]);
            setInputValue('');
            setChatMode('ai');
        } catch (error) {
            toast.error("Sorry, there was an error sending your message. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="fixed bottom-8 right-8 z-40">
                <motion.button
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center shadow-lg hover:shadow-xl focus:outline-none"
                >
                    {isOpen ? <IoClose size={28} /> : <FaCommentDots size={28} />}
                </motion.button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="fixed bottom-28 right-8 z-40 w-[90vw] max-w-sm h-[70vh] max-h-[600px] bg-secondary border border-border-color rounded-lg shadow-2xl flex flex-col"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-border-color flex-shrink-0">
                            <div className="flex items-center space-x-3">
                                {chatMode === 'ai' ? <FaRobot className="text-accent text-xl" /> : <FaHeadset className="text-accent text-xl" />}
                                <h3 className="font-bold text-white">{chatMode === 'ai' ? 'AI Assistant' : 'Contact Support'}</h3>
                            </div>
                            <button onClick={() => setChatMode(chatMode === 'ai' ? 'human' : 'ai')} className="text-xs text-light-gray hover:text-accent">
                                {chatMode === 'ai' ? 'Talk to a human' : 'Ask AI'}
                            </button>
                        </div>

                        <div className="flex-grow p-4 overflow-y-auto">
                            {messages.map((msg, index) => <ChatMessage key={index} msg={msg} />)}
                            {isLoading && chatMode === 'ai' && <ChatMessage msg={{role: 'assistant', content: <Spinner size="sm" />}} />}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-4 border-t border-border-color flex-shrink-0">
                            {chatMode === 'ai' ? (
                                <form onSubmit={handleSendMessage} className="relative">
                                    <Textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Ask a question..." className="w-full !pr-12" rows={2}/>
                                    <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-light-gray hover:text-accent" disabled={isLoading}><FaPaperPlane size={20} /></button>
                                </form>
                            ) : (
                                <form onSubmit={handleContactSubmit} className="space-y-3">
                                    <Input placeholder="Your Name" value={userName} onChange={e => setUserName(e.target.value)} required />
                                    <Input type="email" placeholder="Your Email" value={userEmail} onChange={e => setUserEmail(e.target.value)} required />
                                    <Textarea placeholder="Your message..." value={inputValue} onChange={e => setInputValue(e.target.value)} required rows={3}/>
                                    <Button type="submit" isLoading={isLoading} className="w-full">Send to Support</Button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ChatAssistant;