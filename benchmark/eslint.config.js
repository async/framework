import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["app-health/src/**/*.js", "runner/src/**/*.js", "cli/**/*.js"],
    rules: {
      "no-unused-vars": "off",
      "require-await": "error",
    },
  },
  {
    ignores: ["**/node_modules/", "**/dist/", "**/results/", "**/traces/", "css/"],
  },
  eslintConfigPrettier
);
