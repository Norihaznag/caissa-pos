import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@caissapro_device_id';
const INSTALL_DATE_KEY = '@caissapro_install_date';

/**
 * Get or create a persistent device fingerprint
 * This ID survives app reinstalls (stored in AsyncStorage which persists)
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    // Check if we already have a stored device ID
    const storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (storedId) {
      return storedId;
    }

    // Generate new device fingerprint
    const fingerprint = await generateFingerprint();
    
    // Store it permanently
    await AsyncStorage.setItem(DEVICE_ID_KEY, fingerprint);
    
    return fingerprint;
  } catch (error) {
    console.error('Error getting device fingerprint:', error);
    // Fallback to a random ID if all else fails
    return 'CP-' + Date.now().toString(36).toUpperCase();
  }
}

/**
 * Generate a unique device fingerprint based on multiple factors
 */
async function generateFingerprint(): Promise<string> {
  const components: string[] = [];

  // Installation ID (unique per app install)
  if (Constants.installationId) {
    components.push(Constants.installationId);
  }

  // Device name and model
  components.push(Constants.deviceName || 'unknown');
  
  // Platform info
  components.push(Platform.OS);
  components.push(Platform.Version?.toString() || '');

  // App version
  components.push(Constants.expoConfig?.version || '1.0.0');

  // Manifest ID if available
  if (Constants.expoConfig?.extra?.eas?.projectId) {
    components.push(Constants.expoConfig.extra.eas.projectId);
  }

  // Combine all components
  const combined = components.join('|');

  // Hash it
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );

  // Format as CP-XXXX-XXXX-XXXX (16 chars from hash)
  const short = hash.substring(0, 12).toUpperCase();
  return `CP-${short.substring(0, 4)}-${short.substring(4, 8)}-${short.substring(8, 12)}`;
}

/**
 * Get install date (first time app was launched)
 */
export async function getInstallDate(): Promise<Date> {
  try {
    const stored = await AsyncStorage.getItem(INSTALL_DATE_KEY);
    if (stored) {
      return new Date(stored);
    }

    // First install - record date
    const now = new Date();
    await AsyncStorage.setItem(INSTALL_DATE_KEY, now.toISOString());
    return now;
  } catch {
    return new Date();
  }
}

/**
 * Get device info for display
 */
export function getDeviceInfo(): { name: string; model: string; platform: string } {
  return {
    name: Constants.deviceName || 'Unknown Device',
    model: Platform.OS === 'android' ? 'Android Device' : 'iOS Device',
    platform: `${Platform.OS} ${Platform.Version}`,
  };
}

/**
 * Format device ID for display (with spaces for readability)
 */
export function formatDeviceId(deviceId: string): string {
  return deviceId; // Already formatted as CP-XXXX-XXXX-XXXX
}
