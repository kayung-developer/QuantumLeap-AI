import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose } from 'react-icons/io5';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`
              bg-white dark:bg-primary 
              rounded-xl shadow-2xl 
              w-full max-w-lg mx-auto 
              border border-gray-200 dark:border-border-color 
              flex flex-col max-h-[90vh]
            `}
            initial={{ y: "-50px", opacity: 0 }} animate={{ y: "0", opacity: 1 }} exit={{ y: "50px", opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-gray-100 dark:border-border-color">
              {/* Title: Black */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
              {/* Close Button: Dark Gray */}
              <button onClick={onClose} className="text-gray-500 hover:text-black dark:text-light-gray dark:hover:text-white transition-colors">
                <IoClose size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;