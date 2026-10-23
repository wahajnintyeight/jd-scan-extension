import defaultTheme from 'tailwindcss/defaultTheme.js';

// Shadow-root rem units still use the host page's font size; generate fixed extension units instead.
export function withPixelUnits(value) {
    if (typeof value === 'string') return value.replace(/(-?(?:\d*\.)?\d+)rem\b/g, (_, size) => `${Number(size) * 16}px`);
    if (typeof value === 'function') return (...args) => withPixelUnits(value(...args));
    if (Array.isArray(value)) return value.map(withPixelUnits);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, withPixelUnits(entry)]));
    return value;
}

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./entrypoints/**/*.{html,js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        ...withPixelUnits(defaultTheme),
        extend: {
            colors: {
                border: "oklch(var(--jd-border) / <alpha-value>)",
                input: "oklch(var(--jd-input) / <alpha-value>)",
                ring: "oklch(var(--jd-ring) / <alpha-value>)",
                background: "oklch(var(--jd-background) / <alpha-value>)",
                foreground: "oklch(var(--jd-foreground) / <alpha-value>)",
                overlay: "oklch(var(--jd-overlay) / <alpha-value>)",
                primary: {
                    DEFAULT: "oklch(var(--jd-primary) / <alpha-value>)",
                    foreground: "oklch(var(--jd-primary-foreground) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "oklch(var(--jd-secondary) / <alpha-value>)",
                    foreground: "oklch(var(--jd-secondary-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "oklch(var(--jd-destructive) / <alpha-value>)",
                    foreground: "oklch(var(--jd-destructive-foreground) / <alpha-value>)",
                },
                muted: {
                    DEFAULT: "oklch(var(--jd-muted) / <alpha-value>)",
                    foreground: "oklch(var(--jd-muted-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "oklch(var(--jd-accent) / <alpha-value>)",
                    foreground: "oklch(var(--jd-accent-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "oklch(var(--jd-popover) / <alpha-value>)",
                    foreground: "oklch(var(--jd-popover-foreground) / <alpha-value>)",
                },
                card: {
                    DEFAULT: "oklch(var(--jd-card) / <alpha-value>)",
                    foreground: "oklch(var(--jd-card-foreground) / <alpha-value>)",
                },
                sidebar: {
                    DEFAULT: "oklch(var(--jd-sidebar) / <alpha-value>)",
                    foreground: "oklch(var(--jd-sidebar-foreground) / <alpha-value>)",
                    primary: "oklch(var(--jd-sidebar-primary) / <alpha-value>)",
                    "primary-foreground": "oklch(var(--jd-sidebar-primary-foreground) / <alpha-value>)",
                    accent: "oklch(var(--jd-sidebar-accent) / <alpha-value>)",
                    "accent-foreground": "oklch(var(--jd-sidebar-accent-foreground) / <alpha-value>)",
                    border: "oklch(var(--jd-sidebar-border) / <alpha-value>)",
                    ring: "oklch(var(--jd-sidebar-ring) / <alpha-value>)",
                },
                chart: {
                    1: "oklch(var(--jd-chart-1))",
                    2: "oklch(var(--jd-chart-2))",
                    3: "oklch(var(--jd-chart-3))",
                    4: "oklch(var(--jd-chart-4))",
                    5: "oklch(var(--jd-chart-5))",
                },
                brand: {
                    50: 'oklch(var(--jd-brand-50) / <alpha-value>)',
                    100: 'oklch(var(--jd-brand-100) / <alpha-value>)',
                    200: 'oklch(var(--jd-brand-200) / <alpha-value>)',
                    300: 'oklch(var(--jd-brand-300) / <alpha-value>)',
                    400: 'oklch(var(--jd-brand-400) / <alpha-value>)',
                    500: 'oklch(var(--jd-brand-500) / <alpha-value>)',
                    600: 'oklch(var(--jd-brand-600) / <alpha-value>)',
                    700: 'oklch(var(--jd-brand-700) / <alpha-value>)',
                    800: 'oklch(var(--jd-brand-800) / <alpha-value>)',
                    900: 'oklch(var(--jd-brand-900) / <alpha-value>)',
                },
            },
            borderRadius: {
                xl: "calc(var(--jd-radius) + 2px)",
                lg: "var(--jd-radius)",
                md: "calc(var(--jd-radius) - 2px)",
                sm: "calc(var(--jd-radius) - 4px)",
                '2xl': 'calc(var(--jd-radius) + 4px)',
                '3xl': 'calc(var(--jd-radius) + 4px)',
            },
            fontFamily: {
                sans: ["var(--jd-font-sans)"],
                mono: ["var(--jd-font-mono)"],
                display: ["var(--jd-font-display)"],
            },
            boxShadow: {
                sm: 'var(--jd-shadow-sm)',
                md: 'var(--jd-shadow-md)',
                lg: 'var(--jd-shadow-lg)',
                xl: 'var(--jd-shadow-xl)',
                '2xl': 'var(--jd-shadow-2xl)',
                'premium': 'var(--jd-shadow-soft)',
                'premium-hover': 'var(--jd-shadow-premium-hover)',
                'glow-brand': 'var(--jd-shadow-glow-brand)',
            },
            animation: {
                'fade-in': 'fadeIn 180ms ease-out',
                'slide-up': 'slideUp 180ms ease-out',
                'pulse-soft': 'pulseSoft 2s infinite',
                'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.8' },
                },
                bounceGentle: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-3px)' },
                },
            },
        },
    },
    plugins: [],
}
