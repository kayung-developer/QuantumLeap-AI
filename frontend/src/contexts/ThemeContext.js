// src/contexts/ThemeContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    // Initialize state from localStorage or default to 'system'
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');

    useEffect(() => {
        const root = window.document.documentElement;
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = (newTheme) => {
            root.classList.remove('light', 'dark'); // Clear previous theme

            if (newTheme === 'system') {
                root.classList.add(systemPrefersDark.matches ? 'dark' : 'light');
                localStorage.setItem('theme', 'system');
            } else {
                root.classList.add(newTheme);
                localStorage.setItem('theme', newTheme);
            }
        };

        applyTheme(theme);

        // Listen for changes in system preference
        const mediaQueryListener = (e) => {
            if (theme === 'system') {
                applyTheme('system');
            }
        };

        systemPrefersDark.addEventListener('change', mediaQueryListener);

        return () => {
            systemPrefersDark.removeEventListener('change', mediaQueryListener);
        };
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};