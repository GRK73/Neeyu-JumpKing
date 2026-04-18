import globals from "globals";
import html from "eslint-plugin-html";

export default [
  {
    ignores: ["node_modules/"],
  },
  {
    files: ["**/*.js", "**/*.html"],
    plugins: { html },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
      "no-redeclare": "error",
      "no-dupe-keys": "error"
    }
  }
];