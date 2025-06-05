/* Tailwind CSS Configuration */
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Magic Arena Color Palette
                'arena': {
                    'bg': '#0a0e1a',
                    'surface': '#1a1f2e',
                    'surface-light': '#252a3a',
                    'surface-lighter': '#2f3441',
                    'accent': '#c9aa71',
                    'accent-light': '#ddc78b',
                    'accent-dark': '#9d7c3f',
                    'text': '#e8e8e8',
                    'text-dim': '#a8a8a8',
                    'text-muted': '#6b7280',
                    'border': '#374151',
                    'danger': '#ef4444',
                    'success': '#10b981'
                },
                // Mana Colors
                'mana': {
                    'white': '#fffbd5',
                    'blue': '#0e68ab',
                    'black': '#150b00',
                    'red': '#d3202a',
                    'green': '#00733e',
                    'colorless': '#ccc2c0'
                }
            },
            fontFamily: {
                'magic': ['Cinzel', 'serif'],
                'ui': ['Inter', 'sans-serif']
            },
            boxShadow: {
                'arena': '0 4px 20px rgba(201, 170, 113, 0.3)',
                'arena-lg': '0 10px 40px rgba(201, 170, 113, 0.4)',
                'card': '0 2px 10px rgba(0, 0, 0, 0.5)',
                'card-hover': '0 8px 25px rgba(201, 170, 113, 0.4)',
                'inner-arena': 'inset 0 2px 4px rgba(201, 170, 113, 0.1)'
            },
            backgroundImage: {
                'arena-gradient': 'linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 50%, #252a3a 100%)',
                'card-gradient': 'linear-gradient(135deg, #1a1f2e 0%, #252a3a 100%)',
                'accent-gradient': 'linear-gradient(135deg, #c9aa71 0%, #ddc78b 100%)'
            },
            animation: {
                'float': 'float 3s ease-in-out infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'card-draw': 'cardDraw 0.6s ease-out',
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-arena': 'pulseArena 2s ease-in-out infinite'
            }
        }
    }
};
