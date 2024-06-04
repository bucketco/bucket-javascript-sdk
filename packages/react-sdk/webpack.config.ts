import path from "path";
import { Configuration } from "webpack";

const config: Configuration[] = [
  {
    entry: "./src/index.tsx",
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
    externals: ["react", "react-dom"],
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "bucket-react-sdk.browser.js",
      library: {
        name: "bucket-react-sdk",
        type: "umd",
        export: "default",
      },
    },
  },
];

export default config;
