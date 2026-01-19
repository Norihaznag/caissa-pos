/**
 * Appearance Settings Screen
 * ==========================
 * Admin screen to select and preview app themes.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  TextInput,
  Modal,
} from 'react-native';
import { Check, Palette, Moon, Sun, Sparkles, Download, Upload, Trash2, X, Copy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, Theme } from '../lib/themes/ThemeContext';
import { spacing, borderRadius, fontSize, shadows } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 16) / 2; // 2 columns with padding

interface AppearanceSettingsProps {
  onClose?: () => void;
}

export default function AppearanceSettings({ onClose }: AppearanceSettingsProps) {
  const { theme, themes, setTheme, themeId, colors, importTheme, exportTheme, deleteCustomTheme, customThemes } = useAppTheme();
  const [applying, setApplying] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [exportedJson, setExportedJson] = useState('');

  const handleSelectTheme = async (selectedTheme: Theme) => {
    if (selectedTheme.id === themeId) return;
    
    setApplying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await setTheme(selectedTheme.id);
      
      // Show success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '✅ Thème Appliqué',
        `Le thème "${selectedTheme.name}" a été activé avec succès.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to apply theme:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible de changer le thème. Veuillez réessayer.');
    } finally {
      setApplying(false);
    }
  };

  const getThemeIcon = (themeItem: Theme) => {
    if (themeItem.isDark) {
      return <Moon size={16} color={themeItem.colors.text} />;
    }
    if (themeItem.id === 'moroccan') {
      return <Sparkles size={16} color={themeItem.colors.text} />;
    }
    return <Sun size={16} color={themeItem.colors.text} />;
  };

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Palette size={24} color={colors.primary} />
          <Text style={{ 
            fontSize: fontSize.xl, 
            fontWeight: '700', 
            color: colors.text 
          }}>
            Apparence
          </Text>
        </View>
        <Text style={{ 
          fontSize: fontSize.sm, 
          color: colors.textSecondary 
        }}>
          Choisissez un thème pour personnaliser l&apos;apparence de votre application
        </Text>
      </View>

      {/* Current Theme */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        ...shadows.sm,
      }}>
        <Text style={{ 
          fontSize: fontSize.xs, 
          fontWeight: '600', 
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: spacing.sm,
        }}>
          Thème Actuel
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{
            width: 48,
            height: 48,
            borderRadius: borderRadius.md,
            backgroundColor: theme.preview.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {getThemeIcon(theme)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: fontSize.lg, 
              fontWeight: '700', 
              color: colors.text 
            }}>
              {theme.name}
            </Text>
            <Text style={{ 
              fontSize: fontSize.sm, 
              color: colors.textSecondary 
            }}>
              {theme.description}
            </Text>
          </View>
          <Check size={24} color={colors.success} />
        </View>
      </View>

      {/* Theme Grid */}
      <Text style={{ 
        fontSize: fontSize.md, 
        fontWeight: '600', 
        color: colors.text,
        marginBottom: spacing.md,
      }}>
        Thèmes Disponibles
      </Text>

      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        gap: spacing.md,
        marginBottom: spacing.xxl,
      }}>
        {themes.map((themeItem) => {
          const isSelected = themeItem.id === themeId;
          
          return (
            <TouchableOpacity
              key={themeItem.id}
              onPress={() => handleSelectTheme(themeItem)}
              disabled={applying || isSelected}
              style={{
                width: CARD_WIDTH,
                backgroundColor: themeItem.preview.background,
                borderRadius: borderRadius.lg,
                overflow: 'hidden',
                borderWidth: isSelected ? 3 : 1,
                borderColor: isSelected ? colors.primary : colors.border,
                opacity: applying && !isSelected ? 0.5 : 1,
                ...shadows.sm,
              }}
              activeOpacity={0.7}
            >
              {/* Color Preview */}
              <View style={{ 
                height: 60, 
                flexDirection: 'row',
              }}>
                <View style={{ 
                  flex: 1, 
                  backgroundColor: themeItem.preview.primary 
                }} />
                <View style={{ 
                  flex: 1, 
                  backgroundColor: themeItem.preview.secondary 
                }} />
              </View>

              {/* Theme Info */}
              <View style={{ 
                padding: spacing.md,
                backgroundColor: themeItem.colors.surface,
              }}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: spacing.xs,
                }}>
                  <Text style={{ 
                    fontSize: fontSize.md, 
                    fontWeight: '600', 
                    color: themeItem.colors.text,
                    flex: 1,
                  }} numberOfLines={1}>
                    {themeItem.name}
                  </Text>
                  {isSelected && (
                    <View style={{
                      backgroundColor: colors.success,
                      borderRadius: borderRadius.full,
                      padding: 2,
                    }}>
                      <Check size={12} color={colors.white} />
                    </View>
                  )}
                </View>

                {/* Theme badges */}
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  {themeItem.isDark && (
                    <View style={{
                      backgroundColor: themeItem.colors.secondary,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: borderRadius.full,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Moon size={10} color={themeItem.colors.textSecondary} />
                      <Text style={{ 
                        fontSize: 10, 
                        color: themeItem.colors.textSecondary,
                        fontWeight: '500',
                      }}>
                        Sombre
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Info Box */}
      <View style={{
        backgroundColor: colors.infoLight,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
      }}>
        <Text style={{ 
          fontSize: fontSize.sm, 
          color: colors.info,
          fontWeight: '500',
        }}>
          💡 Le thème est sauvegardé localement et sera appliqué automatiquement au prochain démarrage.
        </Text>
      </View>

      {/* Import / Export Buttons */}
      <View style={{ 
        flexDirection: 'row', 
        gap: spacing.md, 
        marginBottom: spacing.xl 
      }}>
        <TouchableOpacity
          onPress={() => setImportModalVisible(true)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Upload size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '600' }}>Importer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setExportedJson(exportTheme());
            setExportModalVisible(true);
          }}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Download size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '600' }}>Exporter</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Themes Section */}
      {customThemes.length > 0 && (
        <View style={{ marginBottom: spacing.xxl }}>
          <Text style={{ 
            fontSize: fontSize.md, 
            fontWeight: '600', 
            color: colors.text,
            marginBottom: spacing.md,
          }}>
            Thèmes Personnalisés ({customThemes.length})
          </Text>
          {customThemes.map((customTheme) => (
            <View
              key={customTheme.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.sm,
                backgroundColor: customTheme.preview.primary,
                marginRight: spacing.md,
              }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{customTheme.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{customTheme.id}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Supprimer le thème',
                    `Voulez-vous supprimer "${customTheme.name}" ?`,
                    [
                      { text: 'Annuler', style: 'cancel' },
                      { 
                        text: 'Supprimer', 
                        style: 'destructive',
                        onPress: async () => {
                          await deleteCustomTheme(customTheme.id);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                      },
                    ]
                  );
                }}
                style={{ padding: spacing.sm }}
              >
                <Trash2 size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Import Modal */}
      <Modal
        visible={importModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 400,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.text }}>
                Importer un Thème
              </Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <X size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md }}>
              Collez le code JSON du thème ci-dessous :
            </Text>
            
            <TextInput
              value={importJson}
              onChangeText={setImportJson}
              placeholder='{"id": "mon-theme", "name": "Mon Thème", ...}'
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={8}
              style={{
                backgroundColor: colors.background,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                color: colors.text,
                fontSize: fontSize.sm,
                fontFamily: 'monospace',
                minHeight: 150,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: spacing.lg,
              }}
            />

            <TouchableOpacity
              onPress={async () => {
                if (!importJson.trim()) {
                  Alert.alert('Erreur', 'Veuillez entrer le code JSON du thème.');
                  return;
                }
                const result = await importTheme(importJson);
                if (result.success) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('✅ Succès', `Le thème "${result.theme?.name}" a été importé !`);
                  setImportJson('');
                  setImportModalVisible(false);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  Alert.alert('Erreur', result.error || 'Import échoué');
                }
              }}
              style={{
                backgroundColor: colors.primary,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.white, fontWeight: '700' }}>Importer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            width: '100%',
            maxWidth: 400,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.text }}>
                Exporter le Thème
              </Text>
              <TouchableOpacity onPress={() => setExportModalVisible(false)}>
                <X size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md }}>
              Copiez ce code JSON pour partager votre thème :
            </Text>
            
            <View style={{
              backgroundColor: colors.background,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <ScrollView style={{ maxHeight: 200 }}>
                <Text style={{
                  color: colors.text,
                  fontSize: fontSize.xs,
                  fontFamily: 'monospace',
                }}>
                  {exportedJson}
                </Text>
              </ScrollView>
            </View>

            <TouchableOpacity
              onPress={() => {
                Alert.alert('📋 Copié !', 'Le thème a été copié dans le presse-papiers. Utilisez "Coller" pour le partager.');
                setExportModalVisible(false);
              }}
              style={{
                backgroundColor: colors.primary,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: spacing.sm,
              }}
            >
              <Copy size={18} color={colors.white} />
              <Text style={{ color: colors.white, fontWeight: '700' }}>Copier le Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
