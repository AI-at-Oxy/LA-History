/** @type {import('tailwindcss').Config} */
export default {
  // Tell Tailwind which files to scan for class names
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      // Custom era colors that match the existing Flask design system
      colors: {
        era: {
          native:  '#8B6914', // Tongva / pre-contact era — amber/brown
          spanish: '#2D6A4F', // Spanish colonial era — forest green
          rancho:  '#1A3A5C', // Rancho period — deep blue
          modern:  '#8B1A1A', // Modern era — dark red
        },
      },
      fontFamily: {
        // Clean, readable sans-serif stack
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
