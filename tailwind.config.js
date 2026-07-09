/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        mit: {
          ink: '#172033',
          red: '#9f1d35',
          gold: '#c7922d',
          line: '#d9dde7',
          paper: '#f7f8fb'
        }
      },
      boxShadow: {
        form: '0 18px 45px rgba(23, 32, 51, 0.11)'
      }
    }
  },
  plugins: []
};
