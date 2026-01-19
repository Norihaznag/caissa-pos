/**
 * Database Abstraction Layer - Platform Switch
 * 
 * This file exports the correct database implementation based on platform.
 * - Mobile (Android/iOS): Uses expo-sqlite
 * - Windows: Uses react-native-sqlite-storage
 */

import { Platform } from 'react-native';

// Platform-specific imports will be resolved by Metro
export * from './database.interface';

// Re-export the correct implementation based on platform
// The bundler will resolve .windows.ts or .native.ts automatically
