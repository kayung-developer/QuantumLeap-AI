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
    primary: 'bg-accent text-white hover:bg-accent-dark focus:ring-accent disabled:bg-accent/50',
    secondary: 'bg-light-secondary text-light-text border border-light-border hover:bg-gray-200 focus:ring-accent dark:bg-secondary dark:text-light-gray dark:border-border-color dark:hover:bg-primary',
    danger: 'bg-danger text-white hover:bg-red-500 focus:ring-danger disabled:bg-danger/50',
    success: 'bg-success text-white hover:bg-green-500 focus:ring-success disabled:bg-success/50',
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