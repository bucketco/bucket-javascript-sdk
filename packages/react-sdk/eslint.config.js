const base = require("@bucketco/eslint-config/base");

module.exports = [...base, { ignores: ["dist/", "dev/"] }];
