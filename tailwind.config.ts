import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#12100e",
        surface: "#1a1714",
        surface2: "#221e1a",
        surface3: "#2a2520",
        border: "#332e28",
        border2: "#3d3730",
        ember: "#c9622a",
        ember2: "#e07840",
        gold: "#c4922a",
        sage: "#4a7c6f",
        cream: "#f2ebe0",
        muted: "#7a7060",
        dim: "#3d3730",
        text: "#f0e8d8",
      },
      fontFamily: {
        serif: ["'Libre Baskerville'", "serif"],
        sans: ["'Epilogue'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
