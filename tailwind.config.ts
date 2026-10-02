import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-geist)", "sans-serif"] },
      colors: { ink: "#0b0d18", iris: "#b5a3ff", mist: "#a4a9c2", mint: "#92e0c0" },
      boxShadow: { glass: "0 24px 80px #00000030, inset 0 1px 0 #ffffff08", glow: "0 0 30px #a28aff30" },
      animation: { mesh: "mesh 24s ease-in-out infinite alternate" },
      keyframes: { mesh: { "0%": { transform: "translate(-2%, -1%) scale(1)" }, "100%": { transform: "translate(3%, 2%) scale(1.08)" } } },
    },
  },
  plugins: [],
} satisfies Config;
