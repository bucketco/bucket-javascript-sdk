const base = require("@bucketco/eslint-config");
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
      },
    },
    rules: {
      ...vuePlugin.configs.recommended.rules,
      ...vuePlugin.configs["vue3-recommended"].rules,

      // Vue specific rules
      "vue/multi-word-component-names": "off",
      "vue/no-unused-vars": "warn",
      "vue/require-default-prop": "off",
      "vue/require-explicit-emits": "off",
      "vue/no-v-html": "off",
    },
  },
];
