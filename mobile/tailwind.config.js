/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/App.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/i18n/index.ts",
    "./src/screens/*.{js,jsx,ts,tsx}",
    "./src/navigation/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // The agency's palette: variables set by ThemeProvider (src/store/ThemeContext.tsx), from
      // src/classes/Theme.ts. `bg-primary/10` and the like work.
      colors: {
        'primary': 'rgb(var(--color-primary) / <alpha-value>)',
        'nav': 'rgb(var(--color-nav) / <alpha-value>)',
        'on-nav': 'rgb(var(--color-onNav) / <alpha-value>)',
        'canvas': 'rgb(var(--color-canvas) / <alpha-value>)',
        'surface': 'rgb(var(--color-surface) / <alpha-value>)',
        'line': 'rgb(var(--color-line) / <alpha-value>)',
        'ink': 'rgb(var(--color-ink) / <alpha-value>)',
        'muted': 'rgb(var(--color-muted) / <alpha-value>)',
        'ok': 'rgb(var(--color-ok) / <alpha-value>)',
        'info': 'rgb(var(--color-info) / <alpha-value>)',
        'warn': 'rgb(var(--color-warn) / <alpha-value>)',
        'danger': 'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontSize: {
        title: '20px',
        body: '16px',
        meta: '13px',
      },
    },
  },
  plugins: [],
}
