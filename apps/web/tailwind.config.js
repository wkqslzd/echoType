/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Menlo',
          'Consolas',
          'Fira Code',
          'Courier New',
          'ui-monospace',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
