const base = require("@bucketco/eslint-config");

module.exports = [
  ...base,
  {
    // Preact projects
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    settings: {
      react: {
        // We only care about marking h() as being a used variable.
        pragma: "h",
        // We use "react 16.0" to avoid pushing folks to UNSAFE_ methods.
        version: "16.0",
      },
    },
    rules: {
      // Ignore React attributes that are not valid in Preact.
      // Alternatively, we could use the preact/compat alias or turn off the rule.
      "react/no-unknown-property": ["off"],
    },
  },
  { ignores: ["dist/", "example/"] },
];
