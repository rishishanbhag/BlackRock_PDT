/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // TaskPulse-inspired light surface palette.
        // Off-white base, pure-white cards, faint grey borders, emerald accent.
        bg: {
          base: '#fafafa',
          card: '#ffffff',
          elevated: '#f9fafb',
          subtle: '#f3f4f6',
        },
        border: {
          subtle: '#e5e7eb',
          muted: '#d1d5db',
        },
        accent: {
          DEFAULT: '#10b981',
          soft: 'rgba(16,185,129,0.10)',
          ink: '#047857',
        },
        status: {
          healthy: '#10b981',
          degraded: '#f59e0b',
          critical: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16, 24, 40, 0.04), 0 1px 3px 0 rgba(16, 24, 40, 0.03)',
        'card-hover': '0 4px 12px -2px rgba(16, 24, 40, 0.08), 0 2px 4px -1px rgba(16, 24, 40, 0.04)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
