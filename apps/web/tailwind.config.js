/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // All colors use CSS variables so themes work at runtime
        'bg-primary': 'rgb(var(--c-bg-primary) / <alpha-value>)',
        'bg-secondary': 'rgb(var(--c-bg-secondary) / <alpha-value>)',
        'bg-tertiary': 'rgb(var(--c-bg-tertiary) / <alpha-value>)',
        'bg-floating': 'rgb(var(--c-bg-floating) / <alpha-value>)',
        'bg-input': 'rgb(var(--c-bg-input) / <alpha-value>)',
        'text-normal': 'rgb(var(--c-text-normal) / <alpha-value>)',
        'text-header': 'rgb(var(--c-text-header) / <alpha-value>)',
        'text-muted': 'rgb(var(--c-text-muted) / <alpha-value>)',
        'text-link': 'rgb(var(--c-text-link) / <alpha-value>)',
        'interactive-normal': 'rgb(var(--c-interactive-normal) / <alpha-value>)',
        'interactive-hover': 'rgb(var(--c-interactive-hover) / <alpha-value>)',
        'interactive-muted': 'rgb(var(--c-interactive-muted) / <alpha-value>)',
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        'brand-dark': 'rgb(var(--c-brand-dark) / <alpha-value>)',
        'status-online': '#23a559',
        'status-idle': '#f0b232',
        'status-dnd': '#f23f43',
        'status-offline': '#80848e',
        danger: '#da373c',
        success: '#248046',
        warning: '#f0b232',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { transform: 'translateY(10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'scale-in': { from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
}
