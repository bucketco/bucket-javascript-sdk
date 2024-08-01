import path from "path";
import { Configuration } from "webpack";

const config: Configuration[] = [
  // Browser UMD
  {
    entry: "./src/index.ts",
    mode: "production",
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [
            {
              loader: "css-loader",
              options: {
                importLoaders: 1, // See: https://blog.jakoblind.no/postcss-webpack/
              },
            },
            {
              loader: "postcss-loader",
            },
          ],
        },
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: "ts-loader",
              options: {
                configFile: "tsconfig.build.json",
              },
            },
          ],
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    target: "web",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "bucket-browser-sdk.js",
      library: {
        name: "BucketClient",
        type: "umd",
        export: "BucketClient",
      },
    },
  },
];

export default config;
