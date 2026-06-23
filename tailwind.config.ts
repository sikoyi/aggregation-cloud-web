import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f2933',
        line: '#d9e2ec',
        paper: '#f8fafc',
        brand: {
          50: '#eef8ff',
          100: '#d8eefc',
          500: '#2778a6',
          600: '#1f668f',
          700: '#1b5272',
        },
        accent: {
          500: '#a3572d',
          600: '#83451f',
        },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config

