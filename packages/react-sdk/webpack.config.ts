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
    externals: ["react", "react-dom"],
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "bucket-react-sdk.browser.js",
      library: {
        name: "bucket-react-sdk",
        type: "umd",
      },
    },
  },
];

export default config;
