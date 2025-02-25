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
      "react/no-unknown-property": ["error", { ignore: ["class"] }],
    },
  },
  { ignores: ["dist/", "example/"] },
];
