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
                brand: {
                    primary: 'rgb(var(--brand-primary) / <alpha-value>)',
                    secondary: 'rgb(var(--brand-secondary) / <alpha-value>)',
                    bg: 'rgb(var(--brand-bg) / <alpha-value>)',
                    surface: 'rgb(var(--brand-surface) / <alpha-value>)',
                    'surface-2': 'rgb(var(--brand-surface-2) / <alpha-value>)',
                    'surface-3': 'rgb(var(--brand-surface-3) / <alpha-value>)',
                    border: 'rgb(var(--brand-border) / <alpha-value>)',
                    'text-primary': 'rgb(var(--brand-text-primary) / <alpha-value>)',
                    'text-secondary': 'rgb(var(--brand-text-secondary) / <alpha-value>)',
                    'text-muted': 'rgb(var(--brand-text-muted) / <alpha-value>)',
                    success: 'rgb(var(--brand-success) / <alpha-value>)',
                    warning: 'rgb(var(--brand-warning) / <alpha-value>)',
                    danger: 'rgb(var(--brand-danger) / <alpha-value>)',
                    info: 'rgb(var(--brand-info) / <alpha-value>)',
                },
            },
            borderRadius: {
                'xl': '14px',
                '2xl': '18px',
                '3xl': '20px',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            maxWidth: {
                'container': '1360px',
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
                'card-hover': '0 10px 25px rgba(0, 0, 0, 0.08)',
                'glow-primary': '0 0 20px rgb(var(--brand-primary) / 0.15)',
                'glow-secondary': '0 0 20px rgba(124, 77, 255, 0.15)',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'float-delayed': 'float 6s ease-in-out infinite 2s',
                'fade-in': 'fadeIn 0.6s ease-out',
                'slide-up': 'slideUp 0.6s ease-out',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
