// .eslintrc.js (compatible con Node.js 14)
module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module"
  },
  rules: {
    "prettier/prettier": "error",
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
  },
  ignorePatterns: ["**/node_modules", "**/.venv", "dist"]
};
