import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, DbLicense } from './supabaseClient';
import { getDeviceFingerprint, getInstallDate, getDeviceInfo } from './deviceFingerprint';
import { LICENSE_CONFIG } from './config';
import Constants from 'expo-constants';

// Storage keys
const LICENSE_CACHE_KEY = '@caissapro_license_cache';
const LAST_VALIDATION_KEY = '@caissapro_last_validation';

// License status types
export type LicenseStatus = 
  | 'checking'
  | 'trial_active'
  | 'trial_expired'
  | 'licensed'
  | 'expired'
  | 'suspended'
  | 'invalid'
  | 'error';

export interface LicenseState {
  status: LicenseStatus;
  deviceId: string;
  trialDaysRemaining?: number;
  trialExpiresAt?: Date;
  licensePlan?: string;
  licenseExpiresAt?: Date;
  customerName?: string;
  error?: string;
  isOffline?: boolean;
}

export interface LicenseActivationResult {
  success: boolean;
  message: string;
  licenseState?: LicenseState;
}

/**
 * Main License Service class
 */
class LicenseServiceClass {
  private deviceId: string | null = null;
  private cachedState: LicenseState | null = null;

  /**
   * Initialize the license service and check status
   */
  async checkLicense(): Promise<LicenseState> {
    try {
      // Get device ID
      this.deviceId = await getDeviceFingerprint();
      
      // Try online validation first
      const onlineResult = await this.validateOnline();
      if (onlineResult) {
        this.cachedState = onlineResult;
        await this.cacheState(onlineResult);
        return onlineResult;
      }

      // Fallback to offline/cached validation
      return await this.validateOffline();
    } catch (error) {
      console.error('License check error:', error);
      return {
        status: 'error',
        deviceId: this.deviceId || 'unknown',
        error: 'Failed to check license status',
        isOffline: true,
      };
    }
  }

  /**
   * Validate license online with Supabase
   */
  private async validateOnline(): Promise<LicenseState | null> {
    try {
      const deviceId = this.deviceId!;
      
      // Check if device exists in database
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('*, licenses(*)')
        .eq('device_id', deviceId)
        .single();

      if (deviceError && deviceError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine for new devices
        console.error('Device lookup error:', deviceError);
        return null; // Fall back to offline
      }

      // Update last seen
      await this.updateLastSeen(deviceId);

      // Device exists - check license status
      if (device) {
        // Has active license?
        if (device.license_id && device.licenses) {
          const license = device.licenses as DbLicense;
          return this.processLicenseState(license);
        }

        // Check trial status
        if (device.trial_started_at) {
          const trialStart = new Date(device.trial_started_at);
          const trialEnd = new Date(device.trial_expires_at || trialStart);
          
          const now = new Date();
          const msRemaining = trialEnd.getTime() - now.getTime();
          const minutesRemaining = Math.ceil(msRemaining / (1000 * 60));

          if (msRemaining > 0) {
            return {
              status: 'trial_active',
              deviceId,
              trialDaysRemaining: minutesRemaining, // Actually minutes for testing
              trialExpiresAt: trialEnd,
            };
          } else {
            return {
              status: 'trial_expired',
              deviceId,
              trialDaysRemaining: 0,
              trialExpiresAt: trialEnd,
            };
          }
        }
      }

      // New device - start trial
      return await this.startTrial(deviceId);
    } catch (error) {
      console.error('Online validation error:', error);
      return null; // Fall back to offline
    }
  }

  /**
   * Start a new trial for this device
   */
  private async startTrial(deviceId: string): Promise<LicenseState> {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setMinutes(trialEnd.getMinutes() + LICENSE_CONFIG.TRIAL_DURATION_MINUTES);

    const deviceInfo = getDeviceInfo();
    const appVersion = Constants.expoConfig?.version || '1.0.0';

    // Insert device with trial
    const { error } = await supabase
      .from('devices')
      .insert({
        device_id: deviceId,
        device_name: deviceInfo.name,
        device_model: deviceInfo.model,
        app_version: appVersion,
        trial_started_at: now.toISOString(),
        trial_expires_at: trialEnd.toISOString(),
        last_seen_at: now.toISOString(),
      });

    if (error) {
      console.error('Failed to start trial:', error);
      // If insert fails (maybe duplicate), try to fetch existing
      const { data: existing } = await supabase
        .from('devices')
        .select('*')
        .eq('device_id', deviceId)
        .single();

      if (existing?.trial_expires_at) {
        const existingEnd = new Date(existing.trial_expires_at);
        const msRemaining = existingEnd.getTime() - now.getTime();
        const minutesRemaining = Math.ceil(msRemaining / (1000 * 60));
        return {
          status: msRemaining > 0 ? 'trial_active' : 'trial_expired',
          deviceId,
          trialDaysRemaining: Math.max(0, minutesRemaining), // Actually minutes for testing
          trialExpiresAt: existingEnd,
        };
      }
    }

    // Log trial start
    await this.logAction('trial_start', deviceId);

    return {
      status: 'trial_active',
      deviceId,
      trialDaysRemaining: LICENSE_CONFIG.TRIAL_DURATION_MINUTES,
      trialExpiresAt: trialEnd,
    };
  }

  /**
   * Process license data into state
   */
  private processLicenseState(license: DbLicense): LicenseState {
    const deviceId = this.deviceId!;

    // Check license status
    if (license.status === 'suspended') {
      return { status: 'suspended', deviceId };
    }

    if (license.status === 'revoked') {
      return { status: 'invalid', deviceId, error: 'License has been revoked' };
    }

    // Check expiration
    if (license.expires_at) {
      const expiresAt = new Date(license.expires_at);
      if (expiresAt < new Date()) {
        return {
          status: 'expired',
          deviceId,
          licenseExpiresAt: expiresAt,
          licensePlan: license.plan,
        };
      }
    }

    // License is valid
    return {
      status: 'licensed',
      deviceId,
      licensePlan: license.plan,
      licenseExpiresAt: license.expires_at ? new Date(license.expires_at) : undefined,
      customerName: license.customer_name || undefined,
    };
  }

  /**
   * Validate offline using cached data
   */
  private async validateOffline(): Promise<LicenseState> {
    const deviceId = this.deviceId || await getDeviceFingerprint();

    try {
      // Load cached state
      const cached = await AsyncStorage.getItem(LICENSE_CACHE_KEY);
      const lastValidation = await AsyncStorage.getItem(LAST_VALIDATION_KEY);

      if (!cached) {
        // No cache - use install date for trial
        const installDate = await getInstallDate();
        const trialEnd = new Date(installDate);
        // Add trial duration in minutes
        trialEnd.setTime(trialEnd.getTime() + LICENSE_CONFIG.TRIAL_DURATION_MINUTES * 60 * 1000);

        const now = new Date();
        const minutesRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60));

        return {
          status: minutesRemaining > 0 ? 'trial_active' : 'trial_expired',
          deviceId,
          trialDaysRemaining: Math.max(0, minutesRemaining), // Using minutes for testing
          trialExpiresAt: trialEnd,
          isOffline: true,
        };
      }

      const cachedState = JSON.parse(cached) as LicenseState;
      
      // Check offline grace period
      if (lastValidation) {
        const lastDate = new Date(lastValidation);
        const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince > LICENSE_CONFIG.OFFLINE_GRACE_DAYS) {
          return {
            status: 'error',
            deviceId,
            error: 'Please connect to the internet to verify your license',
            isOffline: true,
          };
        }
      }

      // Return cached state with offline flag
      return {
        ...cachedState,
        isOffline: true,
      };
    } catch (error) {
      console.error('Offline validation error:', error);
      return {
        status: 'error',
        deviceId,
        error: 'License validation failed',
        isOffline: true,
      };
    }
  }

  /**
   * Activate a license key
   */
  async activateLicense(licenseKey: string): Promise<LicenseActivationResult> {
    try {
      const deviceId = this.deviceId || await getDeviceFingerprint();
      const normalizedKey = licenseKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Format key (XXXX-XXXX-XXXX-XXXX)
      const formattedKey = normalizedKey.match(/.{1,4}/g)?.join('-') || normalizedKey;

      // Look up license
      const { data: license, error: lookupError } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', formattedKey)
        .single();

      if (lookupError || !license) {
        return {
          success: false,
          message: 'Invalid license key. Please check and try again.',
        };
      }

      // Check if license is available
      if (license.status === 'revoked') {
        return {
          success: false,
          message: 'This license has been revoked.',
        };
      }

      if (license.status === 'active' && license.device_id && license.device_id !== deviceId) {
        return {
          success: false,
          message: 'This license is already activated on another device.',
        };
      }

      // Activate license on this device
      const now = new Date();
      const { error: updateError } = await supabase
        .from('licenses')
        .update({
          device_id: deviceId,
          status: 'active',
          activated_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', license.id);

      if (updateError) {
        console.error('License activation error:', updateError);
        return {
          success: false,
          message: 'Failed to activate license. Please try again.',
        };
      }

      // Update device record
      await supabase
        .from('devices')
        .update({ license_id: license.id })
        .eq('device_id', deviceId);

      // Log activation
      await this.logAction('activate', deviceId, license.id);

      const licenseState: LicenseState = {
        status: 'licensed',
        deviceId,
        licensePlan: license.plan,
        licenseExpiresAt: license.expires_at ? new Date(license.expires_at) : undefined,
        customerName: license.customer_name || undefined,
      };

      await this.cacheState(licenseState);

      return {
        success: true,
        message: 'License activated successfully!',
        licenseState,
      };
    } catch (error) {
      console.error('Activation error:', error);
      return {
        success: false,
        message: 'Connection error. Please check your internet.',
      };
    }
  }

  /**
   * Update last seen timestamp
   */
  private async updateLastSeen(deviceId: string): Promise<void> {
    try {
      await supabase
        .from('devices')
        .update({ 
          last_seen_at: new Date().toISOString(),
          app_version: Constants.expoConfig?.version || '1.0.0',
        })
        .eq('device_id', deviceId);
    } catch (error) {
      console.error('Failed to update last seen:', error);
    }
  }

  /**
   * Log an action for audit trail
   */
  private async logAction(action: string, deviceId: string, licenseId?: string): Promise<void> {
    try {
      await supabase
        .from('license_logs')
        .insert({
          device_id: deviceId,
          license_id: licenseId,
          action,
          metadata: {
            app_version: Constants.expoConfig?.version,
            timestamp: new Date().toISOString(),
          },
        });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  /**
   * Cache license state for offline use
   */
  private async cacheState(state: LicenseState): Promise<void> {
    try {
      await AsyncStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify(state));
      await AsyncStorage.setItem(LAST_VALIDATION_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Failed to cache state:', error);
    }
  }

  /**
   * Get current device ID
   */
  async getDeviceId(): Promise<string> {
    if (!this.deviceId) {
      this.deviceId = await getDeviceFingerprint();
    }
    return this.deviceId;
  }

  /**
   * Get cached state (for quick UI display)
   */
  async getCachedState(): Promise<LicenseState | null> {
    try {
      const cached = await AsyncStorage.getItem(LICENSE_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  /**
   * Clear all license data (for testing/reset)
   */
  async clearLicenseData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        LICENSE_CACHE_KEY,
        LAST_VALIDATION_KEY,
      ]);
      this.cachedState = null;
    } catch (error) {
      console.error('Failed to clear license data:', error);
    }
  }
}

// Export singleton instance
export const LicenseService = new LicenseServiceClass();
