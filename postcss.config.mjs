// postcss.config.mjs
// La configuration de Tailwind est placée directement ici, pour ne dépendre
// d'aucun autre fichier (tailwind.config.ts devient facultatif).
// Palette « Indigo et Orange » : indigo (brand) pour l'identité et l'Édition, orange (accent) pour
// les appels à l'action. Le turquoise (teal), fourni par Tailwind, signale la Boutique.
const config = {
  plugins: {
    tailwindcss: {
      config: {
        content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
        theme: {
          extend: {
            colors: {
              brand: {
                50: "#eef2ff",
                100: "#e0e7ff",
                200: "#c7d2fe",
                300: "#a5b4fc",
                400: "#818cf8",
                500: "#6366f1",
                600: "#4f46e5",
                700: "#4338ca",
                800: "#3730a3",
                900: "#312e81",
                950: "#1e1b4b",
              },
              accent: {
                50: "#fff7ed",
                100: "#ffedd5",
                200: "#fed7aa",
                300: "#fdba74",
                400: "#fb923c",
                500: "#f97316",
                600: "#ea580c",
                700: "#c2410c",
                800: "#9a3412",
                900: "#7c2d12",
              },
            },
            boxShadow: {
              soft: "0 14px 34px -16px rgba(79, 70, 229, 0.38)",
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
