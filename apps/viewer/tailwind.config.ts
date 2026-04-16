import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#ff6633",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f5f5f5",
          foreground: "#262626",
        },
        background: "#ffffff",
        foreground: "#262626",
        muted: {
          DEFAULT: "#f5f5f5",
          foreground: "#737373",
        },
        accent: {
          DEFAULT: "#ff6633",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        border: "#e8e8e8",
        input: "#e8e8e8",
        ring: "#ff6633",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#262626",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
