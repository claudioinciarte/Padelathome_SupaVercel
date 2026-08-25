module.exports = {
  darkMode: 'class',
  content: [
    './public/**/*.html',
    './public/**/*.js',
    './public/**/*.css',
  ],
  theme: {
    extend: {
      colors: {
        // VolT — Amarillo neón, constante en ambos modos (wcag: texto negro encima)
        primary: '#CCFF00',
        'primary-dark': '#B9E600',
        'primary-hover': '#B9E600',
        'on-primary': '#000000',
        volt: '#CCFF00',

        // Superficies / fondos (doble paleta)
        'background-light': '#F4F4F5',
        'background-dark': '#121212',
        'surface-light': '#FFFFFF',
        'surface-dark': '#1E1E24',
        'surface-card': '#1E1E24',
        card: '#1E1E24',

        // Texto
        'text-main-light': '#09090B',
        'text-main-dark': '#FFFFFF',
        'text-primary-light': '#09090B',
        'text-primary-dark': '#FFFFFF',
        'text-muted-light': '#71717A',
        'text-muted-dark': '#A1A1AA',

        // Bordes
        'border-light': '#E4E4E7',
        'border-dark': '#27272A',

        // Estados — doble paleta para contraste
        'status-available-light': '#16A34A',
        'status-available-dark': '#4ADE80',
        'status-available': '#4ADE80',
        'status-open-light': '#D97706',
        'status-open-dark': '#FBBF24',
        'status-open': '#FBBF24',
        'status-booked-light': '#A1A1AA',
        'status-booked-dark': '#52525B',
        'status-booked': '#52525B',
        'status-error': '#FF3333',
        'status-mine': '#CCFF00',
        'status-waitlist': '#A78BFA',

        // Compatibilidad heredada (estados por tema)
        'success-light': '#D1FAE5',
        'success-dark': '#052E16',
        'warning-light': '#FEF3C7',
        'warning-dark': '#431407',
        'danger-light': '#FFE4E6',
        'danger-dark': '#450A0A',
        secondary: '#121212',

        // Escala neutra remapeada a la familia carbón/asfalto de Volt.
        // Permite que las utilidades slate-/gray- existentes en todas las
        // páginas adopten la estética Volt sin tocar cada instancia.
        slate: {
          50: '#F7F7F8',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#3F3F46',
          700: '#2E2E34',
          800: '#1E1E24',
          900: '#121212',
          950: '#0B0B0D',
        },
        gray: {
          50: '#F7F7F8',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#3F3F46',
          700: '#2E2E34',
          800: '#1E1E24',
          900: '#121212',
          950: '#0B0B0D',
        },
        zinc: {
          50: '#F7F7F8',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#3F3F46',
          700: '#2E2E34',
          800: '#1E1E24',
          900: '#121212',
          950: '#0B0B0D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Manrope', 'Inter', 'sans-serif'],
        label: ['Inter', 'sans-serif'],
      },
      fontSize: {
        display: ['2rem', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '800' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '16px',
        '2xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        'volt-light': '0 4px 12px rgba(180, 220, 0, 0.30)',
        'volt-dark': '0 4px 16px rgba(204, 255, 0, 0.20)',
        volt: '0 4px 16px rgba(204, 255, 0, 0.20)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
};