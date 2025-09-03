const base = require("@reflag/eslint-config");
const vuePlugin = require("eslint-plugin-vue");
const vueParser = require("vue-eslint-parser");

module.exports = [
  ...base,
  {
    ignores: ["dist/"],
  },
  {
    // Vue files
    files: ["**/*.vue"],
    plugins: {
      vue: vuePlugin,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        parser: {
          ts: require("@typescript-eslint/parser"),
        },
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.eslint.json",
        },
      },
    },
    rules: {
      ...vuePlugin.configs["flat/strongly-recommended"].rules,

      // Vue specific rules
      "vue/multi-word-component-names": "off",
      "vue/no-unused-vars": "warn",
      "vue/require-default-prop": "off",
      "vue/require-explicit-emits": "off",
      "vue/no-v-html": "off",

      // Import rules for Vue files
      "import/no-unresolved": "off", // Disable for now since we're using TypeScript resolver
    },
  },
];
