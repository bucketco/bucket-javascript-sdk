import path from "path";
import { Configuration } from "webpack";
import nodeExternals from "webpack-node-externals";

const config: Configuration[] = [
  // Node CommmonJS
  {
    entry: "./src/index.ts",
    mode: "production",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    target: "node",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "bucket-tracking-sdk.node.js",
      library: {
        name: "bucket",
        type: "umd",
        export: "default",
      },
    },
    externals: [nodeExternals()],
  },
  // Browser UMD
  {
    entry: "./src/index.ts",
    mode: "production",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    target: "web",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "bucket-tracking-sdk.browser.js",
      library: {
        name: "bucket",
        type: "umd",
        export: "default",
      },
    },
  },
];

export default config;
