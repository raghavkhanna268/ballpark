import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.vite/**",
      "**/node_modules/**",
      "**/.wrangler/**",
      "**/worker-configuration.d.ts",
      "**/assets.generated.ts",
      "**/seed/seed.sql",
      "coverage/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" },
      ],
    },
  },
);
