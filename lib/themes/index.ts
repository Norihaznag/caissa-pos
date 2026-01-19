/**
 * CaissaPro Theme System
 * =====================
 * A comprehensive theme/skin system for the POS app.
 * Allows admins to switch between multiple color palettes.
 * 
 * To add a new theme:
 * 1. Create a new theme object following the Theme type structure
 * 2. Add it to the THEMES array
 * 3. The theme will automatically appear in the Admin panel
 */

// Theme Type Definition
export interface ThemeColors {
  // Core backgrounds
  background: string;
  surface: string;
  card: string;
  border: string;
  borderLight: string;

  // Primary brand color
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryText: string;

  // Secondary color
  secondary: string;
  secondaryLight: string;
  secondaryText: string;

  // Text hierarchy
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Status colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;

  // Overlays
  overlay: string;
  overlayLight: string;

  // Special
  white: string;
}

export interface Theme {
  id: string;
  name: string;
  nameAr?: string; // Arabic name (optional)
  description: string;
  isDark: boolean;
  colors: ThemeColors;
  // Preview colors for the theme selector UI
  preview: {
    primary: string;
    secondary: string;
    background: string;
  };
  // Flag for custom/imported themes
  isCustom?: boolean;
}

// ============================================================================
// THEME 1: DEFAULT / macOS INSPIRED (Exact match to macOS System Preferences)
// ============================================================================
export const defaultTheme: Theme = {
  id: 'default',
  name: 'macOS Classic',
  nameAr: 'ماك كلاسيك',
  description: 'Authentic macOS design with charcoal header and Aqua buttons',
  isDark: false,
  colors: {
    // macOS window background - exact match to System Preferences
    background: '#EDEDED',
    surface: '#F6F6F6',
    card: '#FFFFFF',
    border: '#B3B3B3',
    borderLight: '#CFCFCF',

    // Primary - macOS charcoal header color (from the title bar)
    primary: '#535353',
    primaryLight: '#E5E5E5',
    primaryDark: '#3D3D3D',
    primaryText: '#FFFFFF',

    // Secondary - macOS button/panel gray
    secondary: '#E8E8E8',
    secondaryLight: '#F5F5F5',
    secondaryText: '#333333',

    // Text - macOS system text colors
    text: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',
    textInverse: '#FFFFFF',

    // Status colors - macOS system colors
    success: '#4CD964',
    successLight: '#E8F8EB',
    warning: '#FF9500',
    warningLight: '#FFF4E5',
    danger: '#FF3B30',
    dangerLight: '#FFE5E5',
    info: '#007AFF',
    infoLight: '#E5F1FF',

    // Overlays - macOS sheet/modal style
    overlay: 'rgba(0, 0, 0, 0.4)',
    overlayLight: 'rgba(0, 0, 0, 0.06)',
    white: '#FFFFFF',
  },
  preview: {
    primary: '#535353',
    secondary: '#E8E8E8',
    background: '#EDEDED',
  },
};

// ============================================================================
// THEME 2: DARK MODE
// ============================================================================
export const darkTheme: Theme = {
  id: 'dark',
  name: 'Mode Sombre',
  nameAr: 'الوضع الداكن',
  description: 'Easy on the eyes, perfect for night shifts',
  isDark: true,
  colors: {
    background: '#18191A',
    surface: '#242526',
    card: '#2D2E2F',
    border: '#3E4042',
    borderLight: '#4E4F50',

    primary: '#2D88FF',
    primaryLight: '#263D5C',
    primaryDark: '#1A6FE8',
    primaryText: '#FFFFFF',

    secondary: '#3A3B3C',
    secondaryLight: '#4E4F50',
    secondaryText: '#E4E6EB',

    text: '#E4E6EB',
    textSecondary: '#B0B3B8',
    textMuted: '#8A8D91',
    textInverse: '#18191A',

    success: '#31D158',
    successLight: '#1D3A28',
    warning: '#FFD60A',
    warningLight: '#3D3520',
    danger: '#FF453A',
    dangerLight: '#3D2020',
    info: '#2D88FF',
    infoLight: '#263D5C',

    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
    white: '#FFFFFF',
  },
  preview: {
    primary: '#2D88FF',
    secondary: '#3A3B3C',
    background: '#18191A',
  },
};

// ============================================================================
// THEME 3: MOROCCAN WARM (Gold & Terracotta)
// ============================================================================
export const moroccanTheme: Theme = {
  id: 'moroccan',
  name: 'Marocain Chaleureux',
  nameAr: 'مغربي دافئ',
  description: 'Warm colors inspired by Moroccan heritage',
  isDark: false,
  colors: {
    background: '#FDF8F3',
    surface: '#FFFFFF',
    card: '#FFFBF7',
    border: '#E8DDD4',
    borderLight: '#F0E6DD',

    primary: '#C17F59',
    primaryLight: '#F5E6DB',
    primaryDark: '#A66B47',
    primaryText: '#FFFFFF',

    secondary: '#D4A574',
    secondaryLight: '#F5E6DB',
    secondaryText: '#5C4033',

    text: '#3D2914',
    textSecondary: '#6B5344',
    textMuted: '#9C8577',
    textInverse: '#FFFFFF',

    success: '#4A7C59',
    successLight: '#E3F0E7',
    warning: '#D4A034',
    warningLight: '#FCF3E0',
    danger: '#C45C4A',
    dangerLight: '#FCE8E5',
    info: '#5B8FA8',
    infoLight: '#E5F0F5',

    overlay: 'rgba(61, 41, 20, 0.4)',
    overlayLight: 'rgba(61, 41, 20, 0.1)',
    white: '#FFFFFF',
  },
  preview: {
    primary: '#C17F59',
    secondary: '#D4A574',
    background: '#FDF8F3',
  },
};

// ============================================================================
// THEME 4: MODERN BLUE (Fintech Vibe)
// ============================================================================
export const modernBlueTheme: Theme = {
  id: 'modern-blue',
  name: 'Bleu Moderne',
  nameAr: 'أزرق عصري',
  description: 'Modern fintech-inspired design',
  isDark: false,
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',

    primary: '#3B82F6',
    primaryLight: '#DBEAFE',
    primaryDark: '#2563EB',
    primaryText: '#FFFFFF',

    secondary: '#64748B',
    secondaryLight: '#F1F5F9',
    secondaryText: '#1E293B',

    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textInverse: '#FFFFFF',

    success: '#22C55E',
    successLight: '#DCFCE7',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#DBEAFE',

    overlay: 'rgba(15, 23, 42, 0.4)',
    overlayLight: 'rgba(15, 23, 42, 0.1)',
    white: '#FFFFFF',
  },
  preview: {
    primary: '#3B82F6',
    secondary: '#64748B',
    background: '#F8FAFC',
  },
};

// ============================================================================
// THEME 5: GREEN CALM (Nature/Eco)
// ============================================================================
export const greenCalmTheme: Theme = {
  id: 'green-calm',
  name: 'Vert Nature',
  nameAr: 'أخضر هادئ',
  description: 'Calm and eco-friendly green theme',
  isDark: false,
  colors: {
    background: '#F0FDF4',
    surface: '#FFFFFF',
    card: '#FAFFFE',
    border: '#D1E7DD',
    borderLight: '#E8F5EB',

    primary: '#16A34A',
    primaryLight: '#DCFCE7',
    primaryDark: '#15803D',
    primaryText: '#FFFFFF',

    secondary: '#6B8E7A',
    secondaryLight: '#E8F5EB',
    secondaryText: '#14532D',

    text: '#14532D',
    textSecondary: '#3D6B50',
    textMuted: '#6B8E7A',
    textInverse: '#FFFFFF',

    success: '#16A34A',
    successLight: '#DCFCE7',
    warning: '#CA8A04',
    warningLight: '#FEF9C3',
    danger: '#DC2626',
    dangerLight: '#FEE2E2',
    info: '#0891B2',
    infoLight: '#CFFAFE',

    overlay: 'rgba(20, 83, 45, 0.4)',
    overlayLight: 'rgba(20, 83, 45, 0.1)',
    white: '#FFFFFF',
  },
  preview: {
    primary: '#16A34A',
    secondary: '#6B8E7A',
    background: '#F0FDF4',
  },
};

// ============================================================================
// THEME 6: PURPLE PREMIUM
// ============================================================================
export const purplePremiumTheme: Theme = {
  id: 'purple-premium',
  name: 'Violet Premium',
  nameAr: 'بنفسجي فاخر',
  description: 'Luxurious purple theme for premium feel',
  isDark: false,
  colors: {
    background: '#FAF5FF',
    surface: '#FFFFFF',
    card: '#FEFBFF',
    border: '#E9D5FF',
    borderLight: '#F3E8FF',

    primary: '#9333EA',
    primaryLight: '#F3E8FF',
    primaryDark: '#7C3AED',
    primaryText: '#FFFFFF',

    secondary: '#A78BDB',
    secondaryLight: '#F3E8FF',
    secondaryText: '#581C87',

    text: '#3B0764',
    textSecondary: '#6B21A8',
    textMuted: '#A78BDB',
    textInverse: '#FFFFFF',

    success: '#22C55E',
    successLight: '#DCFCE7',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    danger: '#E11D48',
    dangerLight: '#FFE4E6',
    info: '#8B5CF6',
    infoLight: '#EDE9FE',

    overlay: 'rgba(59, 7, 100, 0.4)',
    overlayLight: 'rgba(59, 7, 100, 0.1)',
    white: '#FFFFFF',
  },
  preview: {
    primary: '#9333EA',
    secondary: '#A78BDB',
    background: '#FAF5FF',
  },
};

// ============================================================================
// THEME 7: SUNSET ORANGE
// ============================================================================
export const sunsetOrangeTheme: Theme = {
  id: 'sunset-orange',
  name: 'Orange Coucher',
  nameAr: 'برتقالي غروب',
  description: 'Warm sunset orange vibes',
  isDark: false,
  colors: {
    background: '#FFFBF5',
    surface: '#FFFFFF',
    card: '#FFFDFB',
    border: '#FED7AA',
    borderLight: '#FFEDD5',

    primary: '#EA580C',
    primaryLight: '#FFEDD5',
    primaryDark: '#C2410C',
    primaryText: '#FFFFFF',

    secondary: '#FB923C',
    secondaryLight: '#FFF7ED',
    secondaryText: '#7C2D12',

    text: '#431407',
    textSecondary: '#7C2D12',
    textMuted: '#C2410C',
    textInverse: '#FFFFFF',

    success: '#16A34A',
    successLight: '#DCFCE7',
    warning: '#EAB308',
    warningLight: '#FEF9C3',
    danger: '#DC2626',
    dangerLight: '#FEE2E2',
    info: '#0284C7',
    infoLight: '#E0F2FE',

    overlay: 'rgba(67, 20, 7, 0.4)',
    overlayLight: 'rgba(67, 20, 7, 0.1)',
    white: '#FFFFFF',
  },
  preview: {
    primary: '#EA580C',
    secondary: '#FB923C',
    background: '#FFFBF5',
  },
};

// ============================================================================
// THEME 8: MIDNIGHT BLUE (Dark Professional)
// ============================================================================
export const midnightBlueTheme: Theme = {
  id: 'midnight-blue',
  name: 'Bleu Nuit',
  nameAr: 'أزرق منتصف الليل',
  description: 'Professional dark blue theme',
  isDark: true,
  colors: {
    background: '#0F172A',
    surface: '#1E293B',
    card: '#1E293B',
    border: '#334155',
    borderLight: '#475569',

    primary: '#38BDF8',
    primaryLight: '#1E3A5F',
    primaryDark: '#0EA5E9',
    primaryText: '#0F172A',

    secondary: '#475569',
    secondaryLight: '#334155',
    secondaryText: '#F1F5F9',

    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    textInverse: '#0F172A',

    success: '#4ADE80',
    successLight: '#1A3D2E',
    warning: '#FBBF24',
    warningLight: '#3D3520',
    danger: '#F87171',
    dangerLight: '#3D2020',
    info: '#38BDF8',
    infoLight: '#1E3A5F',

    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
    white: '#FFFFFF',
  },
  preview: {
    primary: '#38BDF8',
    secondary: '#475569',
    background: '#0F172A',
  },
};

// ============================================================================
// ALL THEMES ARRAY
// ============================================================================
export const THEMES: Theme[] = [
  defaultTheme,
  darkTheme,
  moroccanTheme,
  modernBlueTheme,
  greenCalmTheme,
  purplePremiumTheme,
  sunsetOrangeTheme,
  midnightBlueTheme,
];

// Default theme ID
export const DEFAULT_THEME_ID = 'default';

// Get theme by ID
export function getThemeById(themeId: string): Theme {
  const theme = THEMES.find(t => t.id === themeId);
  return theme || defaultTheme;
}

// Storage key for persisting theme
export const THEME_STORAGE_KEY = 'APP_THEME_ID';
