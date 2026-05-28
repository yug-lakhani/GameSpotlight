/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: '#030615',
        panel: '#061028',
        panelSoft: '#0a1a33',
        accent: '#26b7a8',
        accent2: '#4f6ef5',
        warm: '#e08a2f'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(61, 214, 198, 0.18), 0 24px 80px rgba(0, 0, 0, 0.45)'
      },
      backgroundImage: {
        'hero-grid': 'radial-gradient(circle at top left, rgba(61,214,198,0.18), transparent 28%), radial-gradient(circle at 80% 10%, rgba(108,140,255,0.16), transparent 24%), linear-gradient(180deg, rgba(4,17,31,0.96), rgba(4,17,31,1))'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -10px, 0)' }
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translate3d(0, 18px, 0)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' }
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(14px, -18px, 0) scale(1.06)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' }
        }
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        'fade-up': 'fadeUp 0.6s ease-out both',
        drift: 'drift 10s ease-in-out infinite',
        shimmer: 'shimmer 10s linear infinite'
      }
    }
  },
  plugins: []
};