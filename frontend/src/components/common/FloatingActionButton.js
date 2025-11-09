import React from 'react';
import { motion } from 'framer-motion';

/**
 * A reusable Floating Action Button (FAB) with animations and a tooltip.
 * @param {Object} props
 * @param {Function} props.onClick - The function to call when the button is clicked.
 * @param {React.ReactNode} props.icon - The icon element to display inside the button.
 * @param {string} props.label - The text to display in the tooltip on hover.
 */
const FloatingActionButton = ({ onClick, icon, label }) => {
  return (
    <div className="fixed bottom-8 right-8 z-30 group">
      {/* Tooltip */}
      <div
        className="absolute bottom-full right-1/2 transform translate-x-1/2 mb-2 px-3 py-1.5 bg-secondary text-white text-sm rounded-md shadow-lg
                   opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap"
      >
        {label}
      </div>

      {/* The Button */}
      <motion.button
        onClick={onClick}
        className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center
                   shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2
                   focus:ring-offset-primary focus:ring-accent transform transition-transform duration-300"
        initial={{ scale: 0, y: 100 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
      >
        {icon}
      </motion.button>
    </div>
  );
};

export default FloatingActionButton;