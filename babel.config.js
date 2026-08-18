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
      // Must be last.
      "react-native-reanimated/plugin",
    ],
  };
};
