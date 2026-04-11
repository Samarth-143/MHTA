/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050816",
          900: "#081225",
          800: "#0e1b33",
          700: "#16264a",
        },
        mist: {
          100: "#e6f7ff",
          200: "#c9f0ff",
        },
        accent: {
          cyan: "#7de7ff",
          violet: "#a78bfa",
          mint: "#7ee0c0",
        },
      },
      boxShadow: {
        soft: "0 18px 60px rgba(3, 8, 25, 0.45)",
        glow: "0 0 0 1px rgba(125, 231, 255, 0.12), 0 24px 80px rgba(125, 231, 255, 0.08)",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at top left, rgba(125, 231, 255, 0.18), transparent 34%), radial-gradient(circle at 80% 20%, rgba(167, 139, 250, 0.18), transparent 30%), linear-gradient(135deg, #050816 0%, #081225 45%, #0c1630 100%)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        floatSlow: {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(0, -18px, 0) scale(1.03)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: 0.45 },
          "50%": { opacity: 0.85 },
        },
      },
      animation: {
        floatSlow: "floatSlow 14s ease-in-out infinite",
        pulseSoft: "pulseSoft 3.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};