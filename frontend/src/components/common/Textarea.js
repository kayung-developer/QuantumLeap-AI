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
          w-full p-2 rounded-md transition
          bg-light-primary border border-light-border text-light-text
          focus:ring-2 focus:ring-accent focus:border-accent
          dark:bg-primary dark:border-border-color dark:text-white
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