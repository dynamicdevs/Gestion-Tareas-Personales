/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      // Colores semánticos enlazados a las variables CSS del tema.
      // Permiten usar utilidades como bg-surface, text-fg, border-line, bg-accent...
      colors: {
        bg: "var(--bg)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-soft": "rgb(var(--surface-soft) / <alpha-value>)",
        line: "rgb(var(--border) / <alpha-value>)",
        fg: "rgb(var(--text) / <alpha-value>)",
        "fg-dim": "rgb(var(--text-dim) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-2": "rgb(var(--accent-2) / <alpha-value>)",
        "on-accent": "rgb(var(--on-accent) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
