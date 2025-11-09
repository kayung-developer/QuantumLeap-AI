import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ children, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`
        bg-light-secondary border border-light-border
        dark:bg-secondary dark:border-border-color
        rounded-xl shadow-lg p-6 ${className}
      `}
    >
      {children}
    </motion.div>
  );
};

export default Card;