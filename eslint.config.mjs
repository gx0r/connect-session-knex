import { ESLint } from "eslint";
import parser from "@typescript-eslint/parser";
import plugin from "@typescript-eslint/eslint-plugin";

import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {ESLint.ConfigData} */
export default {
  files: ["src/**/*.ts", "test/**/*.mjs"],
  languageOptions: {
    parser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: "./tsconfig.json",
    },
    globals: globals.node,
  },
  plugins: {
    "@typescript-eslint": plugin,
  },
  rules: {
    ...eslintConfigPrettier.rules,
  },
  ...eslintConfigPrettier.configs,
};
