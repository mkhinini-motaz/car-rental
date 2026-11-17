const preset = require('@react-native/jest-preset');

module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['./jest.setupAfterEnv.js'],
  resolver: 'react-native-reanimated/jest/resolver',
  transform: {
    ...preset.transform,
    // Icon fonts are assets too.
    '^.+\\.ttf$': require.resolve('@react-native/jest-preset/jest/assetFileTransformer.js'),
  },
  // RN libraries ship untranspiled ESM, so let Babel transform them.
  transformIgnorePatterns: [
    'node_modules/(?!(@?react-native.*|@react-navigation|nativewind|@freakycoder)/)',
  ],
};
