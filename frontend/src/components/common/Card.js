import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ children, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`
        bg-white dark:bg-secondary 
        border border-gray-200 dark:border-border-color 
        rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};

export default Card;