import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Garden Tracker / Seed Vault palette — NO GREY
        white: "#FFFFFF",
        // Paper/stone background (Clean Oasis); reduces glare
        paper: "#F9FAFB",
        // Deep Earth slate for text
        slate: {
          DEFAULT: "#1e293b",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
        },
        // Full scale so bg-emerald-600, hover:bg-emerald-700 etc. render (buttons were invisible with only base)
        // Sprout Green #10b981 for success/planting
        emerald: {
          DEFAULT: "#50C878",
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        citrus: "#FFD700",
        // Semantic aliases
        action: "#50C878",
        alert: "#FFD700",
        surface: "#FFFFFF",
      },
      borderRadius: {
        card: "16px",
        "card-lg": "24px",
      },
      boxShadow: {
        card: "0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)",
        float: "0 10px 30px rgba(0, 0, 0, 0.05)",
        soft: "0 4px 20px rgba(0, 0, 0, 0.04)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
