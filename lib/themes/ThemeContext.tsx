/**
 * CaissaPro Theme Context & Provider
 * ==================================
 * Provides global theme access throughout the app.
 * 
 * Usage:
 * - Wrap your app with <AppThemeProvider>
 * - Use the useAppTheme() hook to access theme colors
 * - Use setTheme(themeId) to change the theme
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, ThemeColors, THEMES, DEFAULT_THEME_ID, THEME_STORAGE_KEY, getThemeById, defaultTheme } from './index';

// Storage key for custom themes
const CUSTOM_THEMES_STORAGE_KEY = 'CAISSAPRO_CUSTOM_THEMES';

// Context value type
interface ThemeContextValue {
  theme: Theme;
  colors: ThemeColors;
  isDark: boolean;
  themes: Theme[];
  setTheme: (themeId: string) => Promise<void>;
  themeId: string;
  isLoading: boolean;
  importTheme: (themeJson: string) => Promise<{ success: boolean; error?: string; theme?: Theme }>;
  exportTheme: (themeId?: string) => string;
  deleteCustomTheme: (themeId: string) => Promise<boolean>;
  customThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface AppThemeProviderProps {
  children: ReactNode;
}

/**
 * Validate theme structure
 */
function validateTheme(theme: any): theme is Theme {
  if (!theme || typeof theme !== 'object') return false;
  if (!theme.id || typeof theme.id !== 'string') return false;
  if (!theme.name || typeof theme.name !== 'string') return false;
  if (!theme.colors || typeof theme.colors !== 'object') return false;
  const requiredColors = ['background', 'surface', 'primary', 'text'];
  for (const color of requiredColors) {
    if (!theme.colors[color]) return false;
  }
  return true;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      // Load custom themes first
      const customThemesJson = await AsyncStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
      let loadedCustomThemes: Theme[] = [];
      if (customThemesJson) {
        try {
          loadedCustomThemes = JSON.parse(customThemesJson);
          setCustomThemes(loadedCustomThemes);
        } catch (e) {
          console.error('Failed to parse custom themes:', e);
        }
      }

      // Load saved theme ID
      const savedThemeId = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedThemeId) {
        let theme = THEMES.find(t => t.id === savedThemeId);
        if (!theme) {
          theme = loadedCustomThemes.find(t => t.id === savedThemeId);
        }
        if (theme) {
          setCurrentTheme(theme);
        }
      }
    } catch (error) {
      console.error('Failed to load saved theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = useCallback(async (themeId: string) => {
    try {
      let theme = THEMES.find(t => t.id === themeId);
      if (!theme) {
        theme = customThemes.find(t => t.id === themeId);
      }
      if (theme) {
        setCurrentTheme(theme);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, themeId);
        console.log(`[Theme] Changed to: ${theme.name} (${themeId})`);
      } else {
        console.warn(`[Theme] Theme not found: ${themeId}`);
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
      throw error;
    }
  }, [customThemes]);

  const importTheme = useCallback(async (themeJson: string): Promise<{ success: boolean; error?: string; theme?: Theme }> => {
    try {
      const parsed = JSON.parse(themeJson);
      if (!validateTheme(parsed)) {
        return { success: false, error: 'Format de thème invalide. Vérifiez la structure JSON.' };
      }
      let newId = parsed.id;
      const existingIds = [...THEMES.map(t => t.id), ...customThemes.map(t => t.id)];
      if (existingIds.includes(newId)) {
        newId = `${parsed.id}-${Date.now()}`;
        parsed.id = newId;
      }
      const newTheme: Theme = {
        ...parsed,
        isCustom: true,
        preview: parsed.preview || {
          primary: parsed.colors.primary,
          secondary: parsed.colors.secondary || parsed.colors.surface,
          background: parsed.colors.background,
        },
      };
      const updatedCustomThemes = [...customThemes, newTheme];
      setCustomThemes(updatedCustomThemes);
      await AsyncStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(updatedCustomThemes));
      console.log(`[Theme] Imported: ${newTheme.name} (${newTheme.id})`);
      return { success: true, theme: newTheme };
    } catch (error) {
      console.error('Failed to import theme:', error);
      return { success: false, error: 'Erreur lors de l\'importation. Vérifiez le format JSON.' };
    }
  }, [customThemes]);

  const exportTheme = useCallback((themeId?: string): string => {
    const themeToExport = themeId 
      ? [...THEMES, ...customThemes].find(t => t.id === themeId) || currentTheme
      : currentTheme;
    const exportData = {
      id: themeToExport.id,
      name: themeToExport.name,
      nameAr: themeToExport.nameAr,
      description: themeToExport.description,
      isDark: themeToExport.isDark,
      colors: themeToExport.colors,
      preview: themeToExport.preview,
    };
    return JSON.stringify(exportData, null, 2);
  }, [currentTheme, customThemes]);

  const deleteCustomTheme = useCallback(async (themeId: string): Promise<boolean> => {
    try {
      const updatedCustomThemes = customThemes.filter(t => t.id !== themeId);
      setCustomThemes(updatedCustomThemes);
      await AsyncStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(updatedCustomThemes));
      if (currentTheme.id === themeId) {
        setCurrentTheme(defaultTheme);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME_ID);
      }
      console.log(`[Theme] Deleted: ${themeId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete theme:', error);
      return false;
    }
  }, [customThemes, currentTheme]);

  const allThemes = [...THEMES, ...customThemes];

  const value: ThemeContextValue = {
    theme: currentTheme,
    colors: currentTheme.colors,
    isDark: currentTheme.isDark,
    themes: allThemes,
    setTheme,
    themeId: currentTheme.id,
    isLoading,
    importTheme,
    exportTheme,
    deleteCustomTheme,
    customThemes,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}

export function useThemeColors(): ThemeColors {
  const { colors } = useAppTheme();
  return colors;
}

export { Theme, ThemeColors, THEMES, DEFAULT_THEME_ID, getThemeById };
