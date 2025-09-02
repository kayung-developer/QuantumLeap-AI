// src/components/common/CheckboxWithTooltip.js

import React from 'react';
import { FaQuestionCircle } from 'react-icons/fa';

const CheckboxWithTooltip = ({ id, name, checked, onChange, disabled = false, label, tooltip }) => {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-light-secondary dark:bg-primary text-accent focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <label htmlFor={id} className={`ml-3 block text-sm font-medium ${disabled ? 'text-light-muted dark:text-gray-500' : 'text-light-text dark:text-light-gray'}`}>
        {label}
      </label>

      {tooltip && (
        <div className="relative group flex items-center ml-2">
          <FaQuestionCircle className="text-light-muted dark:text-gray-500" />
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2
                       bg-secondary text-white text-xs text-center rounded-md shadow-lg
                       opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20
                       border border-border-color"
          >
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                          border-x-4 border-x-transparent
                          border-t-4 border-t-secondary"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckboxWithTooltip;