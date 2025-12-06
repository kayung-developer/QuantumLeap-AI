import React from 'react';
import { motion } from 'framer-motion';
import Spinner from './Spinner';

const Button = ({ children, onClick, type = 'button', variant = 'primary', className = '', disabled = false, isLoading = false, size = 'md' }) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ease-in-out disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
  };

  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-dark focus:ring-accent disabled:bg-accent/50 shadow-sm',
    
    // UPDATED SECONDARY: Dark Gray text, definitive border, slight hover gray
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-black focus:ring-gray-200 dark:bg-secondary dark:text-light-gray dark:border-border-color dark:hover:bg-primary',
    
    danger: 'bg-danger text-white hover:bg-red-600 focus:ring-danger disabled:bg-danger/50 shadow-sm',
    success: 'bg-success text-white hover:bg-green-600 focus:ring-success disabled:bg-success/50 shadow-sm',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.05 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.95 }}
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${className}`}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" className="mr-2" />
          Processing...
        </>
      ) : (
        children
      )}
    </motion.button>
  );
};

export default Button;