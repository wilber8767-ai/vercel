/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    screens: {
      xs:   "375px",
      sm:   "640px",
      md:   "768px",
      lg:   "1024px",
      xl:   "1280px",
      "2xl":"1536px",
    },
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0d1117",
          1:       "#161b22",
          2:       "#1c2128",
          3:       "#21262d",
          4:       "#30363d",
        },
        border: {
          DEFAULT: "#30363d",
          muted:   "#21262d",
        },
        life:    "#3b82f6",
        nonlife: "#10b981",
        bonus:   "#f59e0b",
        danger:  "#ef4444",
        muted:   "#8b949e",
        ink:     "#e6edf3",
        "ink-2": "#c9d1d9",
        "ink-3": "#8b949e",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "14px",
        pill: "9999px",
      },
      boxShadow: {
        card:       "0 1px 3px rgba(0,0,0,0.4), 0 4px 24px rgba(0,0,0,0.25)",
        "card-hover":"0 2px 8px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.3)",
        glow:       "0 0 20px rgba(59,130,246,0.25)",
      },
      backdropBlur: {
        glass: "12px",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: 1 },
          "50%":      { opacity: 0.4 },
        },
      },
      animation: {
        "fade-in":   "fade-in 0.25s ease-out forwards",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
