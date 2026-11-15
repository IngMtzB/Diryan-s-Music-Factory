/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          900: "#0b0d13",
          850: "#10141d",
          800: "#161b26",
          700: "#1f2636",
          600: "#2d374d",
          500: "#3d4b68",
        },
        brand: {
          cyan: "#00E5FF",
          pink: "#FF2A55",
          purple: "#A855F7",
          gold: "#FFD600",
        }
      }
    },
  },
  plugins: [],
}

