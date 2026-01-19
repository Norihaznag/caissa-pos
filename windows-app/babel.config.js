module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.windows.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@shared': '../shared',
          '@lib': '../lib',
          '@components': '../components',
        },
      },
    ],
  ],
};
