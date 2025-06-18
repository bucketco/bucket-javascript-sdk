const base = require("@bucketco/eslint-config");

module.exports = [
  ...base,
  { ignores: ["dist/"] },
  {
    files: ["**/*.ts"],
    rules: {
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },
];
