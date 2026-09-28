import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter-tight)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Report design tokens (ported from the source HTML)
        ink: '#0b0f1a',
        body: '#374151',
        muted: '#6b7280',
        line: '#e5e7eb',
        paper: '#ffffff',
        canvas: '#eceef1',
        accent: '#2563eb',
        threat: '#d94f50',
        opport: '#1ab38a',
        mixed: '#b45309',
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
