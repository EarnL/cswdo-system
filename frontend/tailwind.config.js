/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: 'var(--brand-navy)',
          hover: 'var(--brand-hover)',
          gold: 'var(--brand-gold)',
          red: 'var(--brand-red)',
          tint: 'var(--brand-tint)',
          soft: 'var(--brand-soft)',
          border: 'var(--brand-border)',
          cream: 'var(--brand-cream)',
        },
      },
    },
  },
  plugins: [],
}
