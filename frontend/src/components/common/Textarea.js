import React from 'react';

const Textarea = ({ label, name, error, ...props }) => {
  return (
    <div>
      {label && <label htmlFor={name} className="block text-sm font-medium text-light-muted dark:text-light-gray mb-1">{label}</label>}
      <textarea
        id={name}
        name={name}
        rows={4}
        className={`
          w-full p-3 rounded-lg transition-all
          
          /* Light Mode: White bg, Gray-300 border, Black text */
          bg-white border border-gray-300 text-black 
          placeholder-gray-500
          
          /* Dark Mode */
          dark:bg-primary dark:border-border-color dark:text-white dark:placeholder-gray-500
          
          focus:ring-2 focus:ring-accent focus:border-transparent outline-none
          ${error ? 'border-danger focus:ring-danger' : ''}
          ${props.className || ''}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error.message}</p>}
    </div>
  );
};

export default Textarea;