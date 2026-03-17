import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'miller-black': '#0a0a0a',
        'miller-dark': '#141414',
        'miller-gold': '#c9a84c',
        'miller-gold-light': '#e6c96d',
        'miller-gold-dark': '#a07832',
        'miller-cream': '#f5e6c3',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'pulse-gold': 'pulse-gold 2.5s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'fade-up': 'fade-up 0.6s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'pulse-gold': {
          '0%, 100%': {
            boxShadow: '0 0 15px rgba(201, 168, 76, 0.3), 0 0 30px rgba(201, 168, 76, 0.1)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(201, 168, 76, 0.6), 0 0 60px rgba(201, 168, 76, 0.3)',
          },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #a07832 0%, #c9a84c 40%, #e6c96d 60%, #c9a84c 80%, #a07832 100%)',
        'dark-gradient': 'radial-gradient(ellipse at top, #1a1200 0%, #0a0a0a 60%)',
      },
    },
  },
  plugins: [],
}

export default config
