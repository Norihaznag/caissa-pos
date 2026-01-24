/**
 * CaissaPro License Configuration
 * ================================
 * Centralized configuration for the license system.
 * Edit these values to control trial period, pricing, and contact info.
 */

export const LICENSE_CONFIG = {
  // ===========================================
  // TRIAL SETTINGS
  // ===========================================
  
  /**
   * Trial duration in MINUTES for testing, or DAYS for production
   * Examples:
   *   - Testing: 2 (minutes)
   *   - Production: 7 * 24 * 60 = 10080 (7 days in minutes)
   */
  TRIAL_DURATION_MINUTES: 2, // ⚠️ TESTING: 2 min. Change to 10080 for 7 days in production
  
  /**
   * Display unit for trial remaining time
   * 'minutes' for testing, 'days' for production
   */
  TRIAL_DISPLAY_UNIT: 'minutes' as 'minutes' | 'days',
  
  /**
   * Offline grace period in days
   * How long the app works without internet validation
   */
  OFFLINE_GRACE_DAYS: 30,

  // ===========================================
  // SUBSCRIPTION PLAN
  // ===========================================
  
  /**
   * Single subscription plan details
   */
  SUBSCRIPTION: {
    name: 'Annual Subscription',
    nameArabic: 'اشتراك سنوي',
    price: 600,
    currency: 'DH',
    period: '1 year',
    periodArabic: 'سنة واحدة',
    features: [
      'Unlimited products',
      'Unlimited users',
      'Receipt printing',
      'Sales reports',
      'Offline mode',
      'Free updates for 1 year',
      'WhatsApp support',
    ],
    featuresArabic: [
      'منتجات غير محدودة',
      'مستخدمين غير محدودين',
      'طباعة الفواتير',
      'تقارير المبيعات',
      'وضع بدون انترنت',
      'تحديثات مجانية لمدة سنة',
      'دعم واتساب',
    ],
  },

  // ===========================================
  // CONTACT INFO
  // ===========================================
  
  /**
   * WhatsApp contact for purchases
   * Format: country code + number (no + or spaces)
   */
  WHATSAPP_NUMBER: '212600000000', // ⚠️ CHANGE THIS to your actual number
  
  /**
   * Support email
   */
  SUPPORT_EMAIL: 'support@caissapro.com', // ⚠️ CHANGE THIS
  
  /**
   * Website URL
   */
  WEBSITE_URL: 'https://caissapro.com', // ⚠️ CHANGE THIS

  // ===========================================
  // BRANDING
  // ===========================================
  
  APP_NAME: 'CaissaPro',
  COPYRIGHT_YEAR: 2026,
};

// Helper function to get trial duration for calculations
export function getTrialDurationMs(): number {
  return LICENSE_CONFIG.TRIAL_DURATION_MINUTES * 60 * 1000;
}

// Helper to format remaining time based on config
export function formatTrialRemaining(minutes: number): string {
  if (LICENSE_CONFIG.TRIAL_DISPLAY_UNIT === 'days') {
    const days = Math.ceil(minutes / (24 * 60));
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  return `${minutes} min`;
}
