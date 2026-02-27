/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#313338',
        'bg-secondary': '#2b2d31',
        'bg-tertiary': '#1e1f22',
        'bg-floating': '#111214',
        'bg-input': '#1e1f22',
        'text-normal': '#dbdee1',
        'text-muted': '#949ba4',
        'text-link': '#00a8fc',
        'interactive-normal': '#b5bac1',
        'interactive-hover': '#dbdee1',
        'interactive-muted': '#4e5058',
        brand: '#5865f2',
        'brand-dark': '#4752c4',
        'status-online': '#23a559',
        'status-idle': '#f0b232',
        'status-dnd': '#f23f43',
        'status-offline': '#80848e',
        danger: '#da373c',
        success: '#248046',
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
