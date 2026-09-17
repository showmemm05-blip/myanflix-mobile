module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: { "@": "./src" },
          extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
        },
      ],
      // The worklets plugin (formerly "react-native-reanimated/plugin") is not
      // listed here: babel-preset-expo adds it itself whenever the package is
      // installed, and it has to run last.
    ],
  };
};
