/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'og': {
          'forest': '#123c30',
          'forest-deep': '#0d2e26',
          'green': '#1d9e75',
          'green-light': '#5dcaa5',
          'green-bg': '#e1f5ee',
          'night': '#12151c',
          'night-mid': '#1a1a2e',
          'night-border': '#262b38',
          'purple': '#4a154b',
          'purple-mid': '#6d28d9',
          'purple-light': '#8b5cf6',
          'gold': '#ffd400',
          'amber': '#c8860a',
          'amber-bg': '#fff3d6',
          'red': '#e24b4a',
          'red-bg': '#fdecec',
          'blue': '#185fa5',
          'blue-bg': '#e8f0fe',
          'gray': '#f0f0f3',
          'gray-text': '#8e8e93',
          'gray-border': '#e5e5ea',
        }
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['12.5px', { lineHeight: '1.4' }],
        'sm': ['13.5px', { lineHeight: '1.5' }],
        'base': ['14.5px', { lineHeight: '1.5' }],
        'lg': ['17px', { lineHeight: '1.4' }],
        'xl': ['22px', { lineHeight: '1.3' }],
        '2xl': ['28px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        'og': '11px',
        'card': '16px',
        'sheet': '18px',
      },
    },
  },
  plugins: [],
}
