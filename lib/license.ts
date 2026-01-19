import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

// ⚠️ CHANGE THIS to your Gumroad product ID after creating the product
const GUMROAD_PRODUCT_ID = 'YOUR_PRODUCT_ID_HERE';

const LICENSE_STORAGE_KEY = '@caissapro_license';
const SECRET_KEY = 'caissapro-2026-secret-key-change-this';

// Types
export interface LicenseData {
  key: string;
  deviceId: string;
  email: string;
  plan: 'starter' | 'pro' | 'enterprise';
  productName: string;
  purchaseDate: string;
  activatedAt: string;
  lastCheck: string;
  valid: boolean;
}

export interface LicenseResult {
  success: boolean;
  error?: string;
  message?: string;
  data?: LicenseData;
}

export interface LicenseValidation {
  valid: boolean;
  reason?: string;
  data?: LicenseData;
}

/**
 * Get unique device identifier
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Use installation ID + device info for uniqueness
    const installationId = Constants.installationId || 'unknown';
    const deviceName = Constants.deviceName || 'device';
    const combined = `${installationId}-${deviceName}`;
    
    // Hash it for consistency
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );
    
    return hash.substring(0, 32);
  } catch {
    // Fallback
    return 'device-' + Date.now().toString(36);
  }
}

/**
 * Simple encryption for local storage
 */
async function encryptData(data: object): Promise<string> {
  const json = JSON.stringify(data);
  // Simple Base64 encoding with salt (not cryptographically secure, but sufficient for local storage)
  const encoded = Buffer.from(SECRET_KEY + json).toString('base64');
  return encoded;
}

/**
 * Simple decryption for local storage
 */
async function decryptData(encoded: string): Promise<object | null> {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const json = decoded.replace(SECRET_KEY, '');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Activate license with Gumroad
 */
export async function activateLicense(licenseKey: string): Promise<LicenseResult> {
  const deviceId = await getDeviceId();
  
  try {
    // Call Gumroad API
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product_id: GUMROAD_PRODUCT_ID,
        license_key: licenseKey.trim().toUpperCase(),
        increment_uses_count: 'true',
      }).toString(),
    });

    const result = await response.json();

    if (result.success) {
      // Determine plan from variant
      let plan: 'starter' | 'pro' | 'enterprise' = 'starter';
      const variants = (result.purchase.variants || '').toLowerCase();
      if (variants.includes('enterprise')) plan = 'enterprise';
      else if (variants.includes('pro')) plan = 'pro';

      // Create license data
      const licenseData: LicenseData = {
        key: licenseKey.trim().toUpperCase(),
        deviceId,
        email: result.purchase.email || '',
        plan,
        productName: result.purchase.product_name || 'CaissaPro',
        purchaseDate: result.purchase.created_at || new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        lastCheck: new Date().toISOString(),
        valid: true,
      };

      // Save locally
      await saveLicense(licenseData);

      return { success: true, data: licenseData };
    } else {
      return {
        success: false,
        error: 'invalid_key',
        message: 'Clé de licence invalide. Vérifiez et réessayez.',
      };
    }
  } catch (error) {
    console.error('License activation error:', error);
    return {
      success: false,
      error: 'network_error',
      message: 'Erreur de connexion. Vérifiez votre internet.',
    };
  }
}

/**
 * Validate existing license
 */
export async function validateLicense(): Promise<LicenseValidation> {
  try {
    // Load local license
    const license = await loadLicense();
    
    if (!license) {
      return { valid: false, reason: 'no_license' };
    }

    // Check device ID
    const currentDeviceId = await getDeviceId();
    if (license.deviceId !== currentDeviceId) {
      return { valid: false, reason: 'wrong_device' };
    }

    // Check if we need to re-verify with server (every 7 days)
    const lastCheck = new Date(license.lastCheck);
    const daysSinceCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCheck > 7) {
      // Try to verify with server
      try {
        const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            product_id: GUMROAD_PRODUCT_ID,
            license_key: license.key,
            increment_uses_count: 'false',
          }).toString(),
        });

        const result = await response.json();

        if (!result.success || result.purchase.refunded || result.purchase.disputed) {
          await removeLicense();
          return { valid: false, reason: 'revoked' };
        }

        // Update last check
        license.lastCheck = new Date().toISOString();
        await saveLicense(license);
      } catch {
        // Allow offline for 30 days max
        if (daysSinceCheck > 30) {
          return { valid: false, reason: 'offline_too_long' };
        }
      }
    }

    return { valid: true, data: license };
  } catch (error) {
    console.error('License validation error:', error);
    return { valid: false, reason: 'error' };
  }
}

/**
 * Save license to local storage
 */
async function saveLicense(data: LicenseData): Promise<void> {
  try {
    const encrypted = await encryptData(data);
    await AsyncStorage.setItem(LICENSE_STORAGE_KEY, encrypted);
  } catch (error) {
    console.error('Failed to save license:', error);
  }
}

/**
 * Load license from local storage
 */
export async function loadLicense(): Promise<LicenseData | null> {
  try {
    const encrypted = await AsyncStorage.getItem(LICENSE_STORAGE_KEY);
    if (!encrypted) return null;
    
    const data = await decryptData(encrypted);
    return data as LicenseData | null;
  } catch (error) {
    console.error('Failed to load license:', error);
    return null;
  }
}

/**
 * Remove license (for deactivation)
 */
export async function removeLicense(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to remove license:', error);
  }
}

/**
 * Get plan limits
 */
export function getPlanLimits(plan: 'starter' | 'pro' | 'enterprise') {
  const limits = {
    starter: {
      maxProducts: 50,
      maxUsers: 1,
      maxTables: 10,
      reports: false,
      export: false,
    },
    pro: {
      maxProducts: 500,
      maxUsers: 5,
      maxTables: 50,
      reports: true,
      export: true,
    },
    enterprise: {
      maxProducts: -1, // unlimited
      maxUsers: -1,
      maxTables: -1,
      reports: true,
      export: true,
    },
  };
  
  return limits[plan];
}

/**
 * Check if feature is available for current plan
 */
export async function hasFeature(feature: keyof ReturnType<typeof getPlanLimits>): Promise<boolean> {
  const license = await loadLicense();
  if (!license) return false;
  
  const limits = getPlanLimits(license.plan);
  return !!limits[feature];
}
