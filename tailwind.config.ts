import type { Config } from 'tailwindcss'

// Insightive brand tokens, taken from insightive-ai.com (Biocides modules page).
const brand = {
  ink: '#101828',
  'ink-2': '#2a3242',
  muted: '#5a6478',
  faint: '#98a1b2',
  pale: '#fafbfe',
  soft: '#f1f4fa',
  line: '#e4e8f2',
  'line-2': '#d8dfef',
  primary: '#307ef5',
  tint: '#e8eefd',
}

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        head: ['var(--font-head)', 'Sora', 'var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ...brand,
        body: '#3c4557',
        paper: '#ffffff',
        canvas: brand.pale,
        accent: brand.primary,
        threat: '#d94f50',
        opport: '#1ab38a',
        mixed: '#b45309',
        // Tailwind's grey and blue scales, re-tuned to the brand's cool
        // blue-grey neutrals and primary blue so every utility class follows.
        gray: {
          50: '#fafbfe',
          100: '#f1f4fa',
          200: '#e4e8f2',
          300: '#d8dfef',
          400: '#98a1b2',
          500: '#5a6478',
          600: '#475066',
          700: '#2a3242',
          800: '#1b2232',
          900: '#101828',
        },
        blue: {
          50: '#f3f6fe',
          100: '#e8eefd',
          200: '#c7d3f5',
          300: '#9dbaf9',
          400: '#6aa0f8',
          500: '#307ef5',
          600: '#2a6fe0',
          700: '#1f5bc4',
          800: '#1a4a9c',
          900: '#163d7d',
        },
        // customer / category accents
        'cat-retail': '#10b981',
        'cat-end': '#3b82f6',
        'cat-pco': '#f59e0b',
        'cat-food': '#8b5cf6',
        'cat-hosp': '#ec4899',
        'cat-ware': '#6366f1',
        'cat-ag': '#84cc16',
      },
    },
  },
  plugins: [],
}
export default config
