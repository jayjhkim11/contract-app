import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        border: "hsl(0 0% 90%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(0 0% 10%)",
        muted: "hsl(0 0% 96%)",
        "muted-foreground": "hsl(0 0% 40%)",
        primary: "hsl(0 0% 10%)",
        "primary-foreground": "hsl(0 0% 100%)",
        accent: "hsl(220 100% 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
