/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        // Deep-Space Kinetic Glassmorphism Palette
        space: {
          950: '#050508',
          900: '#0A0A0F',
          800: '#0F0F1A',
          700: '#141425',
          600: '#1E1B3A',
          500: '#2D2A5E',
        },
        violet: {
          950: '#1E0B3B',
          900: '#2D0B69',
          800: '#3B0D8A',
          700: '#5B21B6',
          600: '#7C3AED',
          500: '#8B5CF6',
          400: '#A855F7',
          300: '#C084FC',
          200: '#DDD6FE',
          100: '#EDE9FE',
        },
        acid: {
          600: '#15803D',
          500: '#22C55E',
          400: '#22D58D',
          300: '#4ADE80',
          200: '#BBF7D0',
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.04)',
          whiteMd: 'rgba(255, 255, 255, 0.08)',
          whiteLg: 'rgba(255, 255, 255, 0.12)',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(124, 58, 237, 0.4)',
        },
        success: '#22D58D',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        // Legacy aliases kept so existing markup keeps working — CLAUDE.md v3 §2.2 renames them over time.
        syne: ['var(--font-outfit)', 'sans-serif'],
        dm: ['var(--font-inter)', 'sans-serif'],
        outfit: ['var(--font-outfit)', 'sans-serif'],
        inter: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)',
        'glow-violet': 'radial-gradient(ellipse at center, rgba(124, 58, 237, 0.3) 0%, transparent 70%)',
        'glow-acid': 'radial-gradient(ellipse at center, rgba(34, 213, 141, 0.2) 0%, transparent 70%)',
        'hero-gradient': 'radial-gradient(ellipse at top, #1E0B3B 0%, #0A0A0F 60%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        'violet-gradient': 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
        'acid-gradient': 'linear-gradient(135deg, #22D58D 0%, #22C55E 100%)',
        'border-gradient': 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(34,213,141,0.3))',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-violet': '0 0 30px rgba(124, 58, 237, 0.3)',
        'glow-acid': '0 0 30px rgba(34, 213, 141, 0.2)',
        'glow-violet-lg': '0 0 60px rgba(124, 58, 237, 0.4)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.3)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
      minHeight: {
        svh: '100svh',
        dvh: '100dvh',
      },
      fontSize: {
        meta: ['0.75rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
      },
    },
  },
  plugins: [],
};
