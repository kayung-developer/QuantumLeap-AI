import React from 'react';

const Input = ({ label, name, type = 'text', error, ...props }) => {
  return (
    <div>
      {label && <label htmlFor={name} className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">{label}</label>}
      <input
        id={name}
        name={name}
        type={type}
        className={`
          w-full p-2 rounded-md transition
          bg-light-primary border border-light-border text-light-text
          focus:ring-2 focus:ring-accent focus:border-accent
          dark:bg-primary dark:border-border-color dark:text-white
          disabled:bg-gray-100 disabled:dark:bg-secondary/50
          ${error ? 'border-danger focus:ring-danger' : ''}
          ${props.className || ''}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error.message}</p>}
    </div>
  );
};

export default Input;