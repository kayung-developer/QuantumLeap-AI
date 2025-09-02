import React from 'react';

const Spinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`animate-spin rounded-full border-4 border-t-accent border-r-accent border-b-secondary border-l-secondary ${sizeClasses[size]} ${className}`}></div>
  );
};

export default Spinner;