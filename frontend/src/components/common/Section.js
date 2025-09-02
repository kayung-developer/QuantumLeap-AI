import React from 'react';
import { motion } from 'framer-motion';

const Section = ({ children, className = '' }) => (
    <motion.section
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className={`py-20 ${className}`}
    >
        <div className="container mx-auto px-4">
            {children}
        </div>
    </motion.section>
);

export default Section;