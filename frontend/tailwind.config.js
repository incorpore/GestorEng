/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          50: 'rgb(var(--primary) / 0.06)',
          100: 'rgb(var(--primary) / 0.12)',
          600: 'rgb(var(--primary) / <alpha-value>)',
          700: 'rgb(var(--primary-dark) / <alpha-value>)',
        },
      },
      fontFamily: { sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Ubuntu', 'Helvetica Neue', 'Arial', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06)' },
    },
  },
  plugins: [],
}
