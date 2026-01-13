// theme.ts
import { vars } from "nativewind";

// ============================================================================
// FONT CONFIGURATION
// ============================================================================
// Facebook Lite style: Simple, readable fonts
// Using Inter for clean, legible typography on low-end devices
// ============================================================================

export interface ThemeFonts {
  heading: {
    family: string;
    weights: Record<string, string>;
  };
  body: {
    family: string;
    weights: Record<string, string>;
  };
  mono: {
    family: string;
    weights: Record<string, string>;
  };
}

export const themeFonts: ThemeFonts = {
  heading: {
    family: 'Inter',
    weights: {
      normal: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    },
  },
  body: {
    family: 'Inter',
    weights: {
      normal: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
    },
  },
  mono: {
    family: 'JetBrainsMono',
    weights: {
      normal: 'JetBrainsMono_400Regular',
      medium: 'JetBrainsMono_500Medium',
    },
  },
};

// ============================================================================
// FACEBOOK LITE INSPIRED THEME
// ============================================================================
// - White background
// - Light blue accents (#3B82F6 / blue-500)
// - High contrast for readability
// - No gradients, minimal shadows
// - Optimized for sunlight and low-end screens
// ============================================================================

export const lightTheme = vars({
  "--radius": "6", // Smaller radius for flatter look

  // Core colors - Facebook Lite style
  "--background": "255 255 255", // Pure white
  "--foreground": "17 24 39", // Dark gray (gray-900)

  "--card": "255 255 255", // White cards
  "--card-foreground": "17 24 39", // Dark text

  "--popover": "255 255 255",
  "--popover-foreground": "17 24 39",

  // Primary: Facebook blue
  "--primary": "59 130 246", // blue-500
  "--primary-foreground": "255 255 255", // White text

  // Secondary: Light gray
  "--secondary": "243 244 246", // gray-100
  "--secondary-foreground": "17 24 39", // Dark text

  // Muted: Subtle gray
  "--muted": "249 250 251", // gray-50
  "--muted-foreground": "107 114 128", // gray-500

  // Accent: Light blue
  "--accent": "239 246 255", // blue-50
  "--accent-foreground": "30 64 175", // blue-800

  // Destructive: Red for errors
  "--destructive": "239 68 68", // red-500

  // Borders: Light gray for clear separation
  "--border": "229 231 235", // gray-200
  "--input": "229 231 235", // gray-200
  "--ring": "59 130 246", // blue-500

  // Chart colors - Simple, distinct
  "--chart-1": "59 130 246", // blue-500
  "--chart-2": "34 197 94", // green-500
  "--chart-3": "251 146 60", // orange-400
  "--chart-4": "168 85 247", // purple-500
  "--chart-5": "236 72 153", // pink-500

  // Sidebar
  "--sidebar": "255 255 255",
  "--sidebar-foreground": "17 24 39",
  "--sidebar-primary": "59 130 246",
  "--sidebar-primary-foreground": "255 255 255",
  "--sidebar-accent": "243 244 246",
  "--sidebar-accent-foreground": "17 24 39",
  "--sidebar-border": "229 231 235",
  "--sidebar-ring": "59 130 246",
});

export const darkTheme = vars({
  "--radius": "6",

  // Dark mode: High contrast for night use
  "--background": "17 24 39", // gray-900
  "--foreground": "249 250 251", // gray-50

  "--card": "31 41 55", // gray-800
  "--card-foreground": "249 250 251",

  "--popover": "31 41 55",
  "--popover-foreground": "249 250 251",

  "--primary": "96 165 250", // blue-400 (lighter for dark mode)
  "--primary-foreground": "17 24 39",

  "--secondary": "55 65 81", // gray-700
  "--secondary-foreground": "249 250 251",

  "--muted": "55 65 81",
  "--muted-foreground": "156 163 175", // gray-400

  "--accent": "30 58 138", // blue-900
  "--accent-foreground": "249 250 251",

  "--destructive": "248 113 113", // red-400

  "--border": "55 65 81", // gray-700
  "--input": "55 65 81",
  "--ring": "96 165 250", // blue-400

  "--chart-1": "96 165 250", // blue-400
  "--chart-2": "74 222 128", // green-400
  "--chart-3": "251 146 60", // orange-400
  "--chart-4": "192 132 252", // purple-400
  "--chart-5": "244 114 182", // pink-400

  "--sidebar": "31 41 55",
  "--sidebar-foreground": "249 250 251",
  "--sidebar-primary": "96 165 250",
  "--sidebar-primary-foreground": "17 24 39",
  "--sidebar-accent": "55 65 81",
  "--sidebar-accent-foreground": "249 250 251",
  "--sidebar-border": "55 65 81",
  "--sidebar-ring": "96 165 250",
});