// License System - Main exports
export { LicenseService, type LicenseState, type LicenseStatus, type LicenseActivationResult } from './LicenseService';
export { getDeviceFingerprint, getDeviceInfo, formatDeviceId, getInstallDate } from './deviceFingerprint';
export { supabase } from './supabaseClient';
