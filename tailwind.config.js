/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./entrypoints/**/*.{html,js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                border: "rgb(var(--border) / <alpha-value>)",
                input: "rgb(var(--input) / <alpha-value>)",
                ring: "rgb(var(--ring) / <alpha-value>)",
                background: "rgb(var(--background) / <alpha-value>)",
                foreground: "rgb(var(--foreground) / <alpha-value>)",
                primary: {
                    DEFAULT: "rgb(var(--primary) / <alpha-value>)",
                    foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
                    foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
                    foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
                },
                muted: {
                    DEFAULT: "rgb(var(--muted) / <alpha-value>)",
                    foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "rgb(var(--accent) / <alpha-value>)",
                    foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "rgb(var(--popover) / <alpha-value>)",
                    foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
                },
                card: {
                    DEFAULT: "rgb(var(--card) / <alpha-value>)",
                    foreground: "rgb(var(--card-foreground) / <alpha-value>)",
                },
                sidebar: {
                    DEFAULT: "rgb(var(--sidebar) / <alpha-value>)",
                    foreground: "rgb(var(--sidebar-foreground) / <alpha-value>)",
                    primary: "rgb(var(--sidebar-primary) / <alpha-value>)",
                    "primary-foreground": "rgb(var(--sidebar-primary-foreground) / <alpha-value>)",
                    accent: "rgb(var(--sidebar-accent) / <alpha-value>)",
                    "accent-foreground": "rgb(var(--sidebar-accent-foreground) / <alpha-value>)",
                    border: "rgb(var(--sidebar-border) / <alpha-value>)",
                    ring: "rgb(var(--sidebar-ring) / <alpha-value>)",
                },
                chart: {
                    1: "var(--chart-1)",
                    2: "var(--chart-2)",
                    3: "var(--chart-3)",
                    4: "var(--chart-4)",
                    5: "var(--chart-5)",
                },
                // Keep existing brand colors for backward compatibility
                brand: {
                    50: '#f0f7ff',
                    100: '#e0effe',
                    200: '#bae2fd',
                    300: '#7cc9fb',
                    400: '#38aaf7',
                    500: '#0e8ee9',
                    600: '#0271c7',
                    700: '#0359a1',
                    800: '#074c84',
                    900: '#0c406e',
                },
            },
            borderRadius: {
                xl: "calc(var(--radius) + 4px)",
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                '2xl': '1.5rem',
            },
            fontFamily: {
                sans: ["var(--font-sans)"],
                serif: ["var(--font-serif)"],
                mono: ["var(--font-mono)"],
                display: ['Outfit', 'sans-serif'],
            },
            boxShadow: {
                'premium': '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                'premium-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                'glow-brand': '0 0 20px rgba(2, 113, 199, 0.15)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-soft': 'pulseSoft 2s infinite',
                'bounce-gentle': 'bounceGentle 1.5s ease-in-out infinite',
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
                    '50%': { transform: 'translateY(-8px)' },
                },
            },
        },
    },
    plugins: [],
}
