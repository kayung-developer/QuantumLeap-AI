/** @type {import('tailwindcss').Config} */
module.exports = {
   darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- NEW: LIGHT THEME COLORS (used by default) ---
        'light-primary': '#FFFFFF',      // White background for pages
        'light-secondary': '#F6F8FA',    // Off-white for cards, sidebars
        'light-text': '#1F2328',         // Dark text for readability
        'light-heading': '#0D1117',      // Almost black for headings
        'light-muted': '#57606A',        // Muted gray text
        'light-border': '#D0D7DE',       // Light gray borders

        // --- DARK THEME COLORS (used with dark: prefix) ---
        'primary': '#0D1117',
        'secondary': '#161B22',
        'white': '#F0F6FC',
        'light-gray': '#8B949E',
        'border-color': '#30363D',

        // --- SEMANTIC COLORS (used in both themes) ---
        'accent': '#2DD4BF',
        'accent-dark': '#14B8A6',
        'danger': '#F87171',
        'warning': '#FBBF24',
        'success': '#34D399',
      },
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
}