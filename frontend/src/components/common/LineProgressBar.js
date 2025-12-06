// src/components/common/LineProgressBar.js

import React from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

const LineProgressBar = () => {
    const isFetching = useIsFetching();
    const isMutating = useIsMutating();
    const isLoading = isFetching > 0 || isMutating > 0;

    return (
        <AnimatePresence>
            {isLoading && (
                <div
                    // The container is fixed to the top of the viewport for global visibility
                    className="fixed top-0 left-0 w-full h-1 z-50"
                    aria-label="Loading"
                    role="progressbar"
                >
                    <motion.div
                        // The inner bar is the one that animates
                        className="h-full bg-accent"
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }} // Animate all the way across the screen
                        exit={{
                            opacity: 0,
                            transition: { duration: 0.2 }
                        }}
                        transition={{
                            // --- THIS IS THE NEW ANIMATION LOGIC ---
                            // It creates a smooth, continuous loop.
                            duration: 1.5,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "linear",
                        }}
                    />
                </div>
            )}
        </AnimatePresence>
    );
};

export default LineProgressBar;