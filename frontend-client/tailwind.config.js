/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#1a1d21',
        primary: '#7dd3fc', // Sky blue
        accent: '#f43f5e',  // Rose
        ink: '#f8fafc',
        muted: '#64748b',
        success: '#10b981',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          '"Open Sans"',
          '"Helvetica Neue"',
          'sans-serif'
        ],
        display: [
          '"Inter Variable"',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"',
          '"IBM Plex Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace'
        ],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
        'sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0' }],
        'base': ['1rem', { lineHeight: '1.6', letterSpacing: '-0.01em' }],
        'lg': ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.015em', fontWeight: '600' }],
        'xl': ['1.266rem', { lineHeight: '1.4', letterSpacing: '-0.02em', fontWeight: '700' }],
        '2xl': ['1.424rem', { lineHeight: '1.3', letterSpacing: '-0.025em', fontWeight: '800' }],
        '3xl': ['1.602rem', { lineHeight: '1.2', letterSpacing: '-0.03em', fontWeight: '900' }],
        'display': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '900' }],
      },
    },
  },
  plugins: [],
}
