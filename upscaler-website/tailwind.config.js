/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: ['./src/**/*.vue'],
  theme: {
    extend: {
      colors: {
        primary: '#1E1E1E',
        secondary: '#2E2E2E',
      },
    },
  },
  plugins: [],
}

