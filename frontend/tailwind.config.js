/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        nero: {
          bg: '#fff9f2',
          surface: '#fffdf8',
          'surface-hover': '#edf7f3',
          border: '#dccdb9',
          accent: '#d95538',
          'accent-hover': '#c8472c',
          secondary: '#0f766e',
          'secondary-hover': '#0b5f59',
          text: '#241f1b',
          muted: '#5f574f',
          dim: '#8a7d70',
        },
      },
    },
  },
  plugins: [],
};
