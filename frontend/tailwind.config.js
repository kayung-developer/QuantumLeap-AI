/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // --- THIS IS THE CORRECTED AND COMPLETE COLORS OBJECT ---
      colors: {
        // Dark Mode Palette
        'primary': '#0D1117',
        'secondary': '#161B22',
        'accent': '#58A6FF',
        'success': '#238636',
        'danger': '#DA3633',
        'warning': '#D29922',
        'white': '#F0F6FC',
        'light-gray': '#4B5563',
        'border-color': '#30363D',
        'primary-hover': '#21262D',

        // Light Mode Palette
        'light-primary': '#F3F4F6',
        'light-secondary': '#FFFFFF',
        'light-border': '#E5E7EB',
        'light-text': '#374151',
        'light-heading': '#111827',
        'light-muted': '#6B7280',
        'light-hover': '#F9FAFB',
      },
      // Your animation keyframes are correct and do not need to change
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};