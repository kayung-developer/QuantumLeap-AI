// src/components/common/Select.js

import React from 'react';

const Select = ({ label, name, value, onChange, options, disabled = false, required = false }) => {
    return (
        <div className="w-full">
            {label && (
                <label 
                    htmlFor={name} 
                    className="block text-sm font-bold text-light-heading dark:text-gray-300 mb-1"
                >
                    {label}
                </label>
            )}
            <select
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
                required={required}
                className={`
                    w-full p-2.5 
                    /* Light Mode: White bg, Gray border, BLACK TEXT */
                    bg-white border border-gray-300 text-gray-900
                    
                    /* Dark Mode: Dark bg, Dark border, White Text */
                    dark:bg-primary dark:border-border-color dark:text-white
                    
                    rounded-lg shadow-sm 
                    focus:ring-2 focus:ring-accent focus:border-transparent 
                    transition-all outline-none
                    disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-secondary
                `}
            >
                {options.map(option => (
                    <option key={option.value} value={option.value} className="text-gray-900 dark:text-white bg-white dark:bg-primary">
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default Select;