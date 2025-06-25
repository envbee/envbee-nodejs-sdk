// Import required modules and plugins
const { defineConfig } = require("eslint/config");
const js = require("@eslint/js"); // New way to get eslint:recommended
const globals = require("globals");
const pluginPrettier = require("eslint-plugin-prettier");
const configPrettier = require("eslint-config-prettier");

module.exports = defineConfig([
  // 1. Global configuration for all files
  {
    // New `languageOptions` key replaces `env` and `parserOptions`
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      // Define global variables for the Node.js environment
      globals: {
        ...globals.node
      }
    },
    // Manually add the prettier plugin
    plugins: {
      prettier: pluginPrettier
    },
    // Rules to apply to all files
    rules: {
      // This is the core rule from eslint-plugin-prettier
      "prettier/prettier": "error",

      // --- Your other rules ---
      camelcase: ["error", { properties: "never" }],
      "new-cap": ["error", { newIsCap: true, capIsNew: false }],
      "consistent-return": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "prefer-const": "error",
      "id-match": [
        "error",
        "^([A-Z][A-Z0-9_]*|[a-zA-Z][a-zA-Z0-9]*)$",
        {
          properties: false,
          onlyDeclarations: true
        }
      ]
    }
  },

  // 2. Global ignores
  {
    ignores: ["**/node_modules", "**/.venv", "dist"]
  },

  // 3. Extend ESLint's recommended rules
  js.configs.recommended,

  // 4. Prettier config MUST be the very last one to override other style rules.
  configPrettier
]);
