const base = require("@bucketco/eslint-config");

module.exports = [...base, { ignores: ["dist/", "example/"] }];
