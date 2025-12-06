// src/components/common/Input.js

import React from 'react';

const Input = ({
    id,
    name,
    label,
    type = 'text',
    value,
    onChange,
    onKeyDown,
    placeholder,
    required = false,
    disabled = false,
    icon: Icon,
    className = '',
    step,
}) => {
    const inputId = id || name;

    // Added min-w-0 to prevent flexbox collapse
    return (
        <div className={`min-w-0 ${className}`}> 
            {label && (
                <label 
                    htmlFor={inputId} 
                    className="block text-sm font-bold text-light-heading dark:text-light-gray mb-1"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon className="h-5 w-5 text-light-muted dark:text-gray-400" />
                    </div>
                )}
                <input
                    id={inputId}
                    name={name}
                    type={type}
                    value={value}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    step={step}
                    className={`
                        w-full 
                        ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2 
                        bg-white dark:bg-primary 
                        border border-gray-300 dark:border-border-color 
                        rounded-lg 
                        text-black dark:text-white font-medium
                        placeholder-gray-500 dark:placeholder-gray-600
                        focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                        disabled:bg-gray-100 dark:disabled:bg-secondary
                        min-w-0 transition-all
                    `}
                />
            </div>
        </div>
    );
};

export default Input;