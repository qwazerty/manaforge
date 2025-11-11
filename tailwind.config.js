const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/templates/**/*.{html,htm,jinja,jinja2}',
    './app/static/js/**/*.{js,jsx,ts,tsx}',
    './app/static/css/**/*.{css,scss}',
    './app/**/*.{py,md}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-body)', ...defaultTheme.fontFamily.sans],
        ui: ['var(--font-ui)', ...defaultTheme.fontFamily.sans],
        magic: ['var(--font-magic)', ...defaultTheme.fontFamily.serif],
      },
      colors: {
        arena: {
          bg: 'var(--color-arena-bg)',
          surface: 'var(--color-arena-surface)',
          'surface-light': 'var(--color-arena-surface-light)',
          'surface-lighter': 'var(--color-arena-surface-lighter)',
          border: 'var(--color-arena-border)',
          text: 'var(--color-arena-text)',
          'text-dim': 'var(--color-arena-text-dim)',
          muted: 'var(--color-arena-muted)',
          accent: 'var(--color-arena-accent)',
          'accent-light': 'var(--color-arena-accent-light)',
          'accent-dark': 'var(--color-arena-accent-dark)',
          success: 'var(--color-arena-success)',
          danger: 'var(--color-arena-danger)',
          warning: 'var(--color-arena-warning)',
        },
      },
      width: {
        'zone-card': 'var(--zone-card-width)',
        'zone-stack': 'var(--zone-stack-width)',
      },
      height: {
        'zone-card': 'var(--zone-card-height)',
        'zone-stack': 'var(--zone-stack-height)',
      },
    },
  },
  plugins: [],
};
