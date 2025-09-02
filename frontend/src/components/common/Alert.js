import React from 'react';
import { FaInfoCircle, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';

const icons = { info: <FaInfoCircle />, success: <FaCheckCircle />, warning: <FaExclamationTriangle />, error: <FaTimesCircle /> };

const colors = {
  info: 'bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/50 dark:border-blue-500 dark:text-blue-200',
  success: 'bg-green-100 border-green-400 text-green-800 dark:bg-green-900/50 dark:border-green-500 dark:text-green-200',
  warning: 'bg-yellow-100 border-yellow-400 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-500 dark:text-yellow-200',
  error: 'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/50 dark:border-red-500 dark:text-red-200',
};

const Alert = ({ type = 'info', message, className = '' }) => {
  if (!message) return null;
  return (
    <div className={`border-l-4 p-4 my-4 rounded-r-lg flex items-center ${colors[type]} ${className}`} role="alert">
      <div className="mr-3 text-xl">{icons[type]}</div>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};

export default Alert;