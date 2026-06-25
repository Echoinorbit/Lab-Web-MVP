import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".next/**",
      ".agents/**",
      ".claude/**",
      "node_modules/**",
      "coverage/**",
      "public/**",
      ".omc/**",
      ".omo/**",
      ".omx/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    files: ["*.config.js", "ecosystem.config.js", "postcss.config.js"],
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error"
    },
  },
  {
    files: ["tests/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
];
