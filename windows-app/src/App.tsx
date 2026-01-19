/**
 * CaissaPro Windows - App Entry Point
 */

import React from 'react';
import { StatusBar, LogBox } from 'react-native';
import RootNavigator from './navigation/RootNavigator';

// Suppress non-critical warnings in development
LogBox.ignoreLogs([
  'Require cycle:',
  'Remote debugger',
]);

export default function App() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <RootNavigator />
    </>
  );
}
