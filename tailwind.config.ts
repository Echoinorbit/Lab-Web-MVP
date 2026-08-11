import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-yellow": {
          DEFAULT: "hsl(var(--brand-yellow))",
          bright: "hsl(var(--brand-yellow-bright))",
        },
        "accent-mint": "hsl(var(--accent-mint))",
        "accent-magenta": "hsl(var(--accent-magenta))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          raised: "hsl(var(--surface-raised))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          muted: "hsl(var(--sidebar-muted))",
          border: "hsl(var(--sidebar-border))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        ui: ["var(--font-sans)"],
        "ui-medium": ["var(--font-medium)"],
        "ui-bold": ["var(--font-bold)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("portrait", "@media (orientation: portrait)");
      addVariant("landscape", "@media (orientation: landscape)");
      addVariant("hoverable", "@media (any-hover: hover)");
    }),
  ],
};

export default config;
