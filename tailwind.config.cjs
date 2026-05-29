/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1e1e2e',
          surface: '#181825',
          overlay: '#313244',
          text: '#cdd6f4',
          subtext: '#a6adc8',
          muted: '#6c7086',
          accent: '#89b4fa',
          green: '#a6e3a1',
          yellow: '#f9e2af',
          red: '#f38ba8',
        },
      },
      fontFamily: {
        mono: ['Consolas', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
