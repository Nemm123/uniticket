/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#080514',
          subtle: '#0E0924',
          card: 'rgba(23, 15, 52, 0.65)',
          hover: 'rgba(38, 26, 82, 0.75)',
        },
        solana: {
          purple: '#9945FF',
          green: '#14F195',
          cyan: '#00F2FE',
        },
        neon: {
          pink: '#FF007A',
          blue: '#00D8F6',
          purple: '#B026FF',
          yellow: '#FFDF00',
        },
      },
      backgroundImage: {
        'solana-gradient': 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)',
        'cyber-gradient': 'linear-gradient(135deg, #FF007A 0%, #9945FF 50%, #00F2FE 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(38, 23, 86, 0.6) 0%, rgba(15, 10, 36, 0.8) 100%)',
        'glow-radial': 'radial-gradient(circle at 50% 30%, rgba(153, 69, 255, 0.18), transparent 70%)',
      },
      boxShadow: {
        'neon-purple': '0 0 25px -5px rgba(153, 69, 255, 0.5)',
        'neon-green': '0 0 25px -5px rgba(20, 241, 149, 0.5)',
        'neon-pink': '0 0 25px -5px rgba(255, 0, 122, 0.5)',
        'cyber-glow': '0 8px 32px 0 rgba(153, 69, 255, 0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
