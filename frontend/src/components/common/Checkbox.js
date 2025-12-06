import React from 'react';

const Checkbox = ({ label, name, checked, onChange, disabled = false }) => {
    return (
        <div className="flex items-center mt-4">
            <input
                id={name}
                name={name}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-accent bg-gray-100 dark:bg-secondary focus:ring-accent"
            />
            <label htmlFor={name} className="ml-2 block text-sm text-light-text dark:text-gray-300">
                {label}
            </label>
        </div>
    );
};

export default Checkbox;