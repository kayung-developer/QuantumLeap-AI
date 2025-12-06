import React from 'react';

const Spinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-4',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className={`
        animate-spin rounded-full 
        /* Track Color: Gray-200 in Light, Darker in Dark Mode */
        border-gray-200 dark:border-gray-700
        /* Spinner Color: Accent (Blue) */
        border-t-accent border-r-accent 
        ${sizeClasses[size]} 
        ${className}
    `}></div>
  );
};

export default Spinner;