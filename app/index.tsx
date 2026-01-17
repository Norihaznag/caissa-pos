import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Coffee, Database } from 'lucide-react-native';
import { useAppStore } from '../lib/store';
import { initOfflineDatabase, offlineUserService } from '../lib/offline-db';
import { colors, spacing, borderRadius, fontSize, shadows } from '../lib/theme';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(72, (SCREEN_WIDTH - 100) / 3);

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const login = useAppStore((state) => state.login);

  // Initialize offline database on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize the offline database (creates tables and default admin)
        await initOfflineDatabase();
      } catch (error) {
        console.error('Init error:', error);
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, []);

  const handlePinPress = (digit: string) => {
    if (pin.length < 4) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPin = pin + digit;
      setPin(newPin);
      
      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        handleLogin(newPin);
      }
    }
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPin('');
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPin(pin.slice(0, -1));
    }
  };

  const handleLogin = async (pinCode: string) => {
    setLoading(true);
    
    try {
      // FULLY OFFLINE AUTHENTICATION
      // Authenticate using local SQLite database
      const user = await offlineUserService.getByPin(pinCode);
      
      if (!user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Erreur', 'Code PIN incorrect');
        setPin('');
        setLoading(false);
        return;
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Use Zustand store for login
      login({
        id: user.id,
        name: user.name,
        pin: user.pin,
        role: user.role,
      });
      
      // Always go to cashier-simple (fully offline POS)
      router.replace('/cashier-simple');
      
    } catch (error) {
      console.error('Authentication error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Erreur d\'authentification');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const renderNumpadButton = (value: string | number, onPress: () => void, isSpecial = false, key?: string | number) => (
    <TouchableOpacity
      key={key ?? value}
      onPress={onPress}
      disabled={loading}
      accessibilityLabel={typeof value === 'number' ? `Chiffre ${value}` : value}
      accessibilityRole="button"
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: borderRadius.lg,
        backgroundColor: isSpecial ? colors.errorLight : colors.white,
        borderWidth: 1,
        borderColor: isSpecial ? colors.error : colors.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.sm,
      }}
      activeOpacity={0.7}
    >
      <Text style={{
        fontSize: typeof value === 'number' ? 26 : 14,
        fontWeight: '600',
        color: isSpecial ? colors.error : colors.textPrimary,
      }}>
        {value}
      </Text>
    </TouchableOpacity>
  );

  // Show loading screen during initialization
  if (initializing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Coffee size={40} color={colors.white} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: fontSize.md }}>
          Initialisation...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl, paddingBottom: spacing.xl }}>
          {/* Header - Logo & Title */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
            <View style={{
              width: 80,
              height: 80,
              backgroundColor: colors.primary,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
              ...shadows.lg,
            }}>
              <Coffee size={40} color={colors.white} />
            </View>
            <Text style={{ fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs }}>
              CaissaPro
            </Text>
            <Text style={{ fontSize: fontSize.md, color: colors.textSecondary }}>
              Système de caisse intelligent
            </Text>
          </View>

          {/* Offline Mode Indicator */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            marginBottom: spacing.xxl,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              backgroundColor: colors.successLight,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: borderRadius.full,
            }}>
              <Database size={14} color={colors.success} />
              <Text style={{ fontSize: fontSize.xs, color: colors.success, fontWeight: '500' }}>
                Mode Hors ligne
              </Text>
            </View>
          </View>

          {/* PIN Display - Clean Card Style */}
          <View style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing.xl,
            marginBottom: spacing.xl,
            alignItems: 'center',
            ...shadows.sm,
          }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.lg }}>
              Entrez votre code PIN
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {[0, 1, 2, 3].map((index) => (
                <View
                  key={index}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: borderRadius.md,
                    borderWidth: 2,
                    borderColor: pin.length > index ? colors.primary : colors.borderLight,
                    backgroundColor: pin.length > index ? colors.primaryLight : colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {pin.length > index && (
                    <View style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: colors.primary,
                    }} />
                  )}
                </View>
              ))}
            </View>
            {loading && (
              <View style={{ marginTop: spacing.xl }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>

          {/* Number Pad - Clean Grid */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius.xl,
              padding: spacing.lg,
              ...shadows.sm,
            }}>
              {/* Row 1: 1, 2, 3 */}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                {[1, 2, 3].map((num) => (
                  <React.Fragment key={`num-${num}`}>
                    {renderNumpadButton(num, () => handlePinPress(num.toString()), false, `num-${num}`)}
                  </React.Fragment>
                ))}
              </View>
              
              {/* Row 2: 4, 5, 6 */}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                {[4, 5, 6].map((num) => (
                  <React.Fragment key={`num-${num}`}>
                    {renderNumpadButton(num, () => handlePinPress(num.toString()), false, `num-${num}`)}
                  </React.Fragment>
                ))}
              </View>
              
              {/* Row 3: 7, 8, 9 */}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                {[7, 8, 9].map((num) => (
                  <React.Fragment key={`num-${num}`}>
                    {renderNumpadButton(num, () => handlePinPress(num.toString()), false, `num-${num}`)}
                  </React.Fragment>
                ))}
              </View>
              
              {/* Row 4: CLR, 0, ⌫ */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {renderNumpadButton('CLR', handleClear, true, 'clear')}
                {renderNumpadButton(0, () => handlePinPress('0'), false, 'num-0')}
                {renderNumpadButton('⌫', handleBackspace, false, 'backspace')}
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={{ alignItems: 'center', paddingTop: spacing.lg }}>
            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              v1.0.0 • CaissaPro POS
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}