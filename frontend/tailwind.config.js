/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sap: {
          brand: {
            primary: '#0a6ed1',
            'primary-hover': '#085caf',
            'primary-active': '#074888',
          },
          positive: {
            DEFAULT: '#107e3e',
            hover: '#0d6733',
          },
          critical: {
            DEFAULT: '#e9730c',
            hover: '#c7620a',
          },
          negative: {
            DEFAULT: '#bb0000',
            hover: '#a20000',
          },
          informative: '#0a6ed1',
          neutral: {
            bg: '#ffffff',
            border: '#d9d9d9',
            hover: '#f7f7f7',
          },
          shell: {
            bg: '#354a5f',
            hover: '#283848',
          },
          text: {
            primary: '#32363a',
            secondary: '#6a6d70',
            tertiary: '#89919a',
            inverted: '#ffffff',
          },
          bg: {
            base: '#fafafa',
            card: '#ffffff',
            field: '#ffffff',
          },
        },
      },
      spacing: {
        'sap-xs': '0.25rem',
        'sap-sm': '0.5rem',
        'sap-md': '1rem',
        'sap-lg': '1.5rem',
        'sap-xl': '2rem',
      },
      borderRadius: {
        'sap-sm': '0.25rem',
        'sap-md': '0.5rem',
        'sap-lg': '0.75rem',
      },
      boxShadow: {
        'sap-sm': '0 0 0.125rem 0 rgba(0, 0, 0, 0.2)',
        'sap-md': '0 0.125rem 0.5rem 0 rgba(0, 0, 0, 0.15)',
        'sap-lg': '0 0.25rem 1rem 0 rgba(0, 0, 0, 0.15)',
      },
      fontFamily: {
        sap: ['"72"', '"72full"', 'Arial', 'Helvetica', 'sans-serif'],
      },
      fontSize: {
        'sap-sm': '0.75rem',
        'sap-base': '0.875rem',
        'sap-md': '1rem',
        'sap-lg': '1.125rem',
        'sap-xl': '1.5rem',
        'sap-xxl': '2rem',
      },
    },
  },
  plugins: [],
}
