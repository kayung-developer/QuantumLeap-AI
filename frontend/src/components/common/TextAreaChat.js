import React from 'react';

const Textarea = ({ label, name, value, onChange, onKeyDown, placeholder, className = '', disabled = false, required = false }) => {
    return (
        <div>
            {label && (
                <label htmlFor={name} className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">
                    {label}
                </label>
            )}
            <textarea
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                // --- THIS IS THE FIX ---
                // The styles ensure it respects the dark/light theme correctly.
                className={`w-full p-2 bg-light-secondary dark:bg-secondary border border-light-border dark:border-border-color rounded-md text-light-text dark:text-white focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 ${className}`}
                rows="4"
            />
        </div>
    );
};

export default Textarea;