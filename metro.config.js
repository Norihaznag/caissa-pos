// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const fs = require('fs');
const path = require('path');

// React Native Windows paths for block list
let rnwPath = '';
try {
  rnwPath = fs.realpathSync(
    path.resolve(require.resolve('react-native-windows/package.json'), '..'),
  );
} catch (e) {
  // react-native-windows not installed, skip
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add Windows-specific blockList to prevent build issues
if (rnwPath) {
  config.resolver.blockList = [
    // Prevent Windows folder from crashing metro server
    new RegExp(
      `${path.resolve(__dirname, 'windows').replace(/[/\\]/g, '/')}.*`,
    ),
    // Prevent msbuild file locks
    new RegExp(`${rnwPath}/build/.*`),
    new RegExp(`${rnwPath}/target/.*`),
    /.*\.ProjectImports\.zip/,
  ];
}

// Web platform stub for expo-sqlite (not supported on web)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-sqlite') {
    return {
      filePath: path.resolve(__dirname, 'lib/expo-sqlite-stub.web.ts'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
