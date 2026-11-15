/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        police: {
          dark: '#0f172a',      // Dark Slate
          navy: '#1e293b',      // Deep Slate
          khaki: '#854d0e',     // Khaki accent
          gold: '#eab308',      // Police Gold
          red: '#dc2626',       // Emergency Crimson
          blue: '#1d4ed8',      // Police Blue
          light: '#f8fafc',     // Off-white / light slate
          card: '#1e293b',
          border: '#334155',
        }
      }
    },
  },
  plugins: [],
}
