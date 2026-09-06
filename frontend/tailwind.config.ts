import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: {
          DEFAULT: '#E5E7EB', // gray-200
          dark: '#D1D5DB', // gray-300
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F9FAFB', // gray-50
          muted: '#F3F4F6', // gray-100
        },
        primary: {
          DEFAULT: '#000000',
          foreground: '#FFFFFF',
        },
        // Semantic status colors matching design.md
        status: {
          succeeded: {
            bg: '#EEF2FF', // indigo-50
            text: '#3730A3', // indigo-800
            border: '#C7D2FE', // indigo-200
            dot: '#4F46E5', // indigo-600
          },
          matched: {
            bg: '#ECFDF5', // emerald-50
            text: '#065F46', // emerald-800
            border: '#A7F3D0', // emerald-200
            dot: '#10B981', // emerald-500
          },
          pending: {
            bg: '#FFFBEB', // amber-50
            text: '#92400E', // amber-800
            border: '#FDE68A', // amber-200
            dot: '#F59E0B', // amber-500
          },
          processing: {
            bg: '#FEF3C7', // amber-100
            text: '#78350F', // amber-900
            border: '#FCD34D', // amber-300
            dot: '#D97706', // amber-600
          },
          failed: {
            bg: '#FEF2F2', // red-50
            text: '#991B1B', // red-800
            border: '#FECACA', // red-200
            dot: '#DC2626', // red-600
          },
          discrepancy: {
            bg: '#FFF1F2', // rose-50
            text: '#9F1239', // rose-800
            border: '#FECDD3', // rose-200
            dot: '#E11D48', // rose-600
          },
          refunded: {
            bg: '#F1F5F9', // slate-100
            text: '#334155', // slate-700
            border: '#CBD5E1', // slate-300
            dot: '#64748B', // slate-500
          },
          revoked: {
            bg: '#F3F4F6', // gray-100
            text: '#4B5563', // gray-600
            border: '#E5E7EB', // gray-200
            dot: '#9CA3AF', // gray-400
          },
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        md: '4px',
        DEFAULT: '2px',
      },
      boxShadow: {
        none: 'none',
        brutal: '2px 2px 0px #000000',
        'brutal-sm': '1px 1px 0px #000000',
      },
    },
  },
  plugins: [],
};

export default config;
