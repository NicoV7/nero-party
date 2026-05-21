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
          bg: '#1c1917',
          surface: '#231f1c',
          'surface-hover': '#2d2825',
          border: '#3d3632',
          accent: '#d4a037',
          'accent-hover': '#c4922d',
          text: '#f5f0eb',
          muted: '#a39e98',
          dim: '#6b6560',
        },
      },
    },
  },
  plugins: [],
};
