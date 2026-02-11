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
        // Fresh Antigravity palette — NO GREY
        white: "#FFFFFF",
        // Full scale so bg-emerald-600, hover:bg-emerald-700 etc. render (buttons were invisible with only base)
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
      boxShadow: {
        antigravity: "0 10px 30px rgba(0, 0, 0, 0.05)",
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
