const base = require("@bucketco/eslint-config/base");
const pluginVue = require("eslint-plugin-vue");

module.exports = [
  ...base,
  { ignores: ["dist/", "example/"] },
  ...pluginVue.configs["flat/recommended"],
];
