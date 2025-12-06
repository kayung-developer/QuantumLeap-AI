import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { FaDesktop, FaSun, FaMoon } from 'react-icons/fa';

const AppearanceSettingsTab = () => {
    const { theme, setTheme } = useTheme();
    const themes = [
        { name: 'light', label: 'Light', icon: <FaSun /> },
        { name: 'dark', label: 'Dark', icon: <FaMoon /> },
        { name: 'system', label: 'System', icon: <FaDesktop /> },
    ];

    return (
        <div>
            <h3 className="text-xl font-bold text-light-heading dark:text-white mb-2">Theme</h3>
            <p className="text-sm text-light-muted dark:text-light-gray mb-6">
                Select a theme for your dashboard experience.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {themes.map((t) => (
                    <button key={t.name} onClick={() => setTheme(t.name)}
                        className={`
                            p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center shadow-sm
                            ${theme === t.name 
                                ? 'border-accent bg-blue-50 text-accent dark:bg-accent/10' 
                                // Inactive: White bg, Gray border, Gray text
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:text-black dark:border-border-color dark:bg-primary dark:text-gray-400 dark:hover:text-white'
                            }
                        `}>
                        <div className="text-2xl mb-2">{t.icon}</div>
                        <span className="font-semibold">{t.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default AppearanceSettingsTab;