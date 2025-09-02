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
            className="bg-light-primary dark:bg-primary rounded-lg shadow-xl w-full max-w-lg mx-auto border border-light-border dark:border-border-color flex flex-col max-h-[90vh]"
            initial={{ y: "-50px", opacity: 0 }} animate={{ y: "0", opacity: 1 }} exit={{ y: "50px", opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-light-border dark:border-border-color">
              <h3 className="text-xl font-semibold text-accent">{title}</h3>
              <button onClick={onClose} className="text-light-muted dark:text-light-gray hover:text-light-text dark:hover:text-white">
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