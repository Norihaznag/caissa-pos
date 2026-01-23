// macOS Design System - Clean, Professional POS Theme
// Inspired by macOS System Preferences / Panel design

export const colors = {
  // Primary - macOS Blue (subtle, not oversaturated)
  primary: '#007AFF',
  primaryLight: '#E5F2FF',
  primaryDark: '#0066DD',
  
  // Secondary accents - Apple system colors
  success: '#34C759',
  successLight: '#E8F8ED',
  warning: '#FF9500',
  warningLight: '#FFF4E5',
  error: '#FF3B30',
  errorLight: '#FFEBE9',
  
  // Neutral palette - macOS style
  white: '#FFFFFF',
  background: '#ECECEC',
  surface: '#FFFFFF',
  border: '#CFCFCF',
  borderLight: '#D7D7D7',
  
  // Text hierarchy
  textPrimary: '#111111',
  textSecondary: '#666666',
  textMuted: '#999999',
  textInverse: '#FFFFFF',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.08)',
  
  // macOS specific
  toolbar: '#E8E8E8',
  separator: '#D7D7D7',
  cardBorder: '#CFCFCF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 14,
  full: 9999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  title: 26,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Shadow presets - macOS style (very subtle)
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
};

// Touch target sizes - minimum for accessibility
export const touchTargets = {
  minimum: 44,
  comfortable: 48,
  large: 56,
  tablet: {
    minimum: 48,
    comfortable: 52,
    large: 60,
  },
};

// Tablet-optimized font sizes
export const fontSizeTablet = {
  xs: 13,
  sm: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  title: 34,
};

// Common component styles - macOS design
export const commonStyles = {
  // Buttons - macOS style (subtle gradients via border)
  buttonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 40,
  },
  buttonSecondary: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 40,
  },
  buttonOutline: {
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 40,
  },
  // Quantity icon buttons - macOS squircle style
  iconButtonSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  iconButtonSquarePressed: {
    backgroundColor: '#E0E0E0',
  },
  iconButtonDestructive: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFF0F0',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  
  // Cards - macOS panel style
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
  },
  
  // Input - macOS style
  input: {
    backgroundColor: colors.white,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  // Chip/Pill - macOS segmented control style
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  
  // Toolbar - macOS style
  toolbar: {
    backgroundColor: colors.toolbar,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  
  // Icon button - macOS style (header close/action buttons)
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#C8C8C8',
  },
  iconButtonHover: {
    backgroundColor: '#D8D8D8',
    borderColor: '#B8B8B8',
  },
  
  // Tab/Segment control - macOS style
  tabSegment: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    gap: 6,
  },
  tabSegmentActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
};

export default {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  commonStyles,
};
