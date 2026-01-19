import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Key, CheckCircle, AlertCircle, Phone, Mail } from 'lucide-react-native';
import { colors, spacing, borderRadius, fontSize, shadows } from '../lib/theme';
import { activateLicense, validateLicense, LicenseData } from '../lib/license';
import * as Haptics from 'expo-haptics';

interface LicenseActivationProps {
  onActivated: (license: LicenseData) => void;
}

export default function LicenseActivation({ onActivated }: LicenseActivationProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkExistingLicense = async () => {
      try {
        const result = await validateLicense();
        if (result.valid && result.data) {
          onActivated(result.data);
        }
      } catch {
        console.error('License check failed');
      }
      setChecking(false);
    };
    checkExistingLicense();
  }, [onActivated]);

  const formatLicenseKey = (value: string): string => {
    // Remove non-alphanumeric and convert to uppercase
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Format as XXXX-XXXX-XXXX-XXXX-XXXX
    const parts: string[] = [];
    for (let i = 0; i < cleaned.length && i < 20; i += 4) {
      parts.push(cleaned.substring(i, i + 4));
    }
    
    return parts.join('-');
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Veuillez entrer une clé de licence');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await activateLicense(licenseKey);

      if (result.success && result.data) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onActivated(result.data);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(result.message || 'Erreur d\'activation');
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Erreur de connexion. Vérifiez votre internet.');
    }

    setLoading(false);
  };

  const openPurchaseLink = () => {
    // ⚠️ CHANGE THIS to your Gumroad product URL
    Linking.openURL('https://gumroad.com/l/YOUR_PRODUCT_URL');
  };

  const openWhatsApp = () => {
    // ⚠️ CHANGE THIS to your WhatsApp number
    Linking.openURL('https://wa.me/212600000000?text=Bonjour, je souhaite acheter une licence CaissaPro');
  };

  if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
            ...shadows.lg,
          }}>
            <Shield size={40} color={colors.white} />
          </View>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSize.md }}>
            Vérification de la licence...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xxl, marginTop: spacing.xl }}>
            <View style={{
              width: 90,
              height: 90,
              borderRadius: 24,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
              ...shadows.lg,
            }}>
              <Key size={45} color={colors.white} />
            </View>
            <Text style={{
              fontSize: 28,
              fontWeight: '700',
              color: colors.textPrimary,
              marginBottom: spacing.xs,
            }}>
              Activer CaissaPro
            </Text>
            <Text style={{
              fontSize: fontSize.md,
              color: colors.textSecondary,
              textAlign: 'center',
            }}>
              Entrez votre clé de licence pour débloquer l&apos;application
            </Text>
          </View>

          {/* License Input */}
          <View style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing.xl,
            ...shadows.md,
            marginBottom: spacing.xl,
          }}>
            <Text style={{
              fontSize: fontSize.sm,
              fontWeight: '600',
              color: colors.textPrimary,
              marginBottom: spacing.sm,
            }}>
              Clé de Licence
            </Text>
            <TextInput
              value={licenseKey}
              onChangeText={(text) => {
                setLicenseKey(formatLicenseKey(text));
                setError('');
              }}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={24}
              editable={!loading}
              style={{
                fontSize: 18,
                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                letterSpacing: 2,
                textAlign: 'center',
                padding: spacing.lg,
                backgroundColor: colors.background,
                borderRadius: borderRadius.lg,
                borderWidth: 2,
                borderColor: error ? colors.error : colors.borderLight,
                color: colors.textPrimary,
              }}
            />

            {/* Error Message */}
            {error ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: spacing.md,
                padding: spacing.md,
                backgroundColor: colors.errorLight,
                borderRadius: borderRadius.md,
              }}>
                <AlertCircle size={18} color={colors.error} />
                <Text style={{
                  marginLeft: spacing.sm,
                  color: colors.error,
                  fontSize: fontSize.sm,
                  flex: 1,
                }}>
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Activate Button */}
            <TouchableOpacity
              onPress={handleActivate}
              disabled={loading || !licenseKey.trim()}
              style={{
                marginTop: spacing.lg,
                backgroundColor: loading || !licenseKey.trim() ? colors.textMuted : colors.success,
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                ...shadows.sm,
              }}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <CheckCircle size={20} color={colors.white} />
                  <Text style={{
                    marginLeft: spacing.sm,
                    color: colors.white,
                    fontSize: fontSize.md,
                    fontWeight: '600',
                  }}>
                    Activer la Licence
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Purchase Options */}
          <View style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing.xl,
            ...shadows.md,
          }}>
            <Text style={{
              fontSize: fontSize.md,
              fontWeight: '600',
              color: colors.textPrimary,
              textAlign: 'center',
              marginBottom: spacing.lg,
            }}>
              Pas encore de licence ?
            </Text>

            {/* Buy Online */}
            <TouchableOpacity
              onPress={openPurchaseLink}
              style={{
                backgroundColor: colors.primary,
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Mail size={20} color={colors.white} />
              <Text style={{
                marginLeft: spacing.sm,
                color: colors.white,
                fontSize: fontSize.md,
                fontWeight: '600',
              }}>
                Acheter en ligne
              </Text>
            </TouchableOpacity>

            {/* WhatsApp Contact */}
            <TouchableOpacity
              onPress={openWhatsApp}
              style={{
                backgroundColor: '#25D366',
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Phone size={20} color={colors.white} />
              <Text style={{
                marginLeft: spacing.sm,
                color: colors.white,
                fontSize: fontSize.md,
                fontWeight: '600',
              }}>
                Contacter via WhatsApp
              </Text>
            </TouchableOpacity>

            {/* Pricing Info */}
            <View style={{ marginTop: spacing.xl }}>
              <Text style={{
                fontSize: fontSize.sm,
                color: colors.textSecondary,
                textAlign: 'center',
                marginBottom: spacing.md,
              }}>
                Nos offres :
              </Text>
              
              <View style={{ gap: spacing.sm }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderLight,
                }}>
                  <Text style={{ color: colors.textPrimary }}>Starter</Text>
                  <Text style={{ fontWeight: '600', color: colors.primary }}>199 DH/mois</Text>
                </View>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderLight,
                }}>
                  <Text style={{ color: colors.textPrimary }}>Pro</Text>
                  <Text style={{ fontWeight: '600', color: colors.primary }}>499 DH/mois</Text>
                </View>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                }}>
                  <Text style={{ color: colors.textPrimary }}>Enterprise</Text>
                  <Text style={{ fontWeight: '600', color: colors.primary }}>999 DH/mois</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Footer */}
          <Text style={{
            textAlign: 'center',
            color: colors.textMuted,
            fontSize: fontSize.xs,
            marginTop: spacing.xl,
          }}>
            © 2026 CaissaPro - Tous droits réservés
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
