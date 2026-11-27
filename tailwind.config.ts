import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.ts'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0A192F', 900: '#0A192F', 800: '#0D1B2A', 700: '#112240', 600: '#1B2F4E', 500: '#233A5E' },
        cian: { DEFAULT: '#14B8D4', 400: '#00B4D8', 300: '#5DD8EC' },
        texto: { DEFAULT: '#FFFFFF', sec: '#CBD5E1' },
        riesgo: { bajo: '#22C55E', medio: '#FACC15', alto: '#EF4444' },
        aviso: { amarillo: '#FACC15', naranja: '#F97316', rojo: '#EF4444' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
