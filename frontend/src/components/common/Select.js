import React from 'react';

const Select = ({ label, name, value, onChange, options, disabled = false, required = false }) => {
    return (
        <div className="w-full">
            {label && <label htmlFor={name} className="block text-sm font-medium text-light-text dark:text-gray-300 mb-1">{label}</label>}
            <select
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
                required={required}
                className="w-full p-2 bg-light-secondary dark:bg-primary border border-light-border dark:border-border-color rounded-md shadow-sm focus:ring-accent focus:border-accent transition"
            >
                {options.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default Select;