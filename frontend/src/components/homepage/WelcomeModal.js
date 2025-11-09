// src/components/homepage/WelcomeModal.js (NEW FILE)

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../common/Button';
import { FaRocket } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5'; // Corrected import path

const WelcomeModal = ({ onClose }) => {
    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="bg-secondary border border-border-color rounded-lg shadow-xl w-full max-w-lg mx-auto relative p-8 text-center"
                    initial={{ y: "-50px", opacity: 0 }}
                    animate={{ y: "0", opacity: 1 }}
                    exit={{ y: "50px", opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={onClose} className="absolute top-4 right-4 text-light-gray hover:text-white">
                        <IoClose size={24} />
                    </button>

                    <img src="/app.png" alt="QuantumLeap AI Logo" className="mx-auto h-16 w-16 mb-6" />

                    <h2 className="text-3xl font-bold text-white mb-4">Welcome to QuantumLeap AI</h2>
                    <p className="text-light-gray text-lg mb-8">
                        The all-in-one platform to build, backtest, and deploy your trading strategies. Automate your success, starting today.
                    </p>

                    <Button onClick={onClose} size="md" className="w-full sm:w-auto">
                        Explore the Platform
                    </Button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default WelcomeModal;
