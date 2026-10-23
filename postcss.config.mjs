// postcss.config.mjs
// La configuration de Tailwind est placée directement ici, pour ne dépendre
// d'aucun autre fichier (tailwind.config.ts devient facultatif).
const config = {
  plugins: {
    tailwindcss: {
      config: {
        content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
        theme: {
          extend: {
            colors: {
              brand: {
                50: "#eef6ff",
                100: "#d9eaff",
                200: "#bcdbff",
                300: "#8ec3ff",
                400: "#59a1ff",
                500: "#3380fc",
                600: "#1d60f1",
                700: "#154bde",
                800: "#183eb4",
                900: "#193890",
                950: "#142458",
              },
            },
            fontFamily: {
              sans: [
                "ui-sans-serif",
                "system-ui",
                "-apple-system",
                "Segoe UI",
                "Roboto",
                "Helvetica Neue",
                "Arial",
                "sans-serif",
              ],
            },
          },
        },
        plugins: [],
      },
    },
    autoprefixer: {},
  },
};

export default config;
