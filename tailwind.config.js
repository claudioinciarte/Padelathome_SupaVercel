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
        // Vercel-aligned — azul primario clásico
        primary: '#2563EB',
        'primary-dark': '#60A5FA',   // azul claro (dark CTA / estados)
        'primary-hover': '#1D4ED8',
        'on-primary': '#FFFFFF',
        'on-primary-dark': '#000000', // texto negro sobre azul claro
        brand: '#006E37',

        // Superficies
        'background-light': '#FAFAFA',
        'background-dark': '#000000',
        'surface-light': '#FFFFFF',
        'surface-dark': '#0A0A0A',
        'surface-card': '#0A0A0A',

        // Texto
        'text-main-light': '#111827',
        'text-main-dark': '#EDEDED',
        'text-primary-light': '#111827',
        'text-primary-dark': '#EDEDED',
        'text-muted-light': '#666666',
        'text-muted-dark': '#888888',

        // Bordes
        'border-light': '#EAEAEA',
        'border-dark': '#333333',

        // Estados
        'status-available-light': '#16A34A',
        'status-available-dark': '#4ADE80',
        'status-available': '#4ADE80',
        'status-open-light': '#F59E0B',
        'status-open-dark': '#FBBF24',
        'status-open': '#FBBF24',
        'status-booked-light': '#888888',
        'status-booked-dark': '#888888',
        'status-booked': '#888888',
        'status-error': '#E00000',
        'status-mine': '#2563EB',
        'status-waitlist': '#8B5CF6',

        // Compatibilidad heredada
        'success-light': '#DCFCE7',
        'success-dark': '#14532D',
        'warning-light': '#FEF3C7',
        'warning-dark': '#451A03',
        'danger-light': '#FEE2E2',
        'danger-dark': '#450A0A',
        secondary: '#0F172A',

        // Escala neutra remapeada a neutros Vercel (fondo #000 / #FAFAFA)
        slate: {
          50: '#FAFAFA', 100: '#F5F5F5', 200: '#EAEAEA', 300: '#DDDDDD',
          400: '#999999', 500: '#888888', 600: '#666666', 700: '#444444',
          800: '#262626', 900: '#0A0A0A', 950: '#000000',
        },
        gray: {
          50: '#FAFAFA', 100: '#F5F5F5', 200: '#EAEAEA', 300: '#DDDDDD',
          400: '#999999', 500: '#888888', 600: '#666666', 700: '#444444',
          800: '#262626', 900: '#0A0A0A', 950: '#000000',
        },
        zinc: {
          50: '#FAFAFA', 100: '#F5F5F5', 200: '#EAEAEA', 300: '#DDDDDD',
          400: '#999999', 500: '#888888', 600: '#666666', 700: '#444444',
          800: '#262626', 900: '#0A0A0A', 950: '#000000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Inter', 'sans-serif'],
      },
      fontSize: {
        display: ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        'card-light': '0 2px 4px rgba(0,0,0,0.02)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
};