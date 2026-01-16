import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Store, Utensils, Wifi, WifiOff } from 'lucide-react-native';
import { useAppStore } from '../lib/store';
import { userService } from '../lib/services';
import { shiftService } from '../lib/shift-service';
import { checkConnectivity } from '../lib/sync-manager';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.max(40, Math.min((SCREEN_WIDTH - 80) / 3, 80)); // Min 40px, Max 80px, responsive

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [appMode, setAppMode] = useState<'full' | 'simple'>('full');
  const [isOnline, setIsOnline] = useState(true);
  const router = useRouter();
  const login = useAppStore((state) => state.login);

  // Check connectivity and load saved mode on mount
  useEffect(() => {
    const init = async () => {
      const online = await checkConnectivity();
      setIsOnline(online);
      
      // Load saved mode preference
      const savedMode = await AsyncStorage.getItem('pos_app_mode');
      if (savedMode === 'simple' || savedMode === 'full') {
        setAppMode(savedMode);
      }
    };
    init();
  }, []);

  const toggleMode = async () => {
    const newMode = appMode === 'full' ? 'simple' : 'full';
    setAppMode(newMode);
    await AsyncStorage.setItem('pos_app_mode', newMode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

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
      // Simple mode - direct to cashier-simple (offline first)
      if (appMode === 'simple') {
        // For simple mode, use a default cashier user
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        login({
          id: 'cashier-simple',
          name: 'Caissier',
          pin: pinCode,
          role: 'cashier',
        });
        router.replace('/cashier-simple');
        return;
      }
      
      // Full mode - Authenticate with Supabase
      const user = await userService.authenticateByPin(pinCode);
      
      if (!user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Erreur', 'Code PIN incorrect');
        setPin('');
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
      
      // Navigate based on role
      if (user.role === 'waiter') {
        // Check if waiter has active shift
        const shiftCheck = await shiftService.checkActiveShift(user.id);
        if (!shiftCheck.canWork) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert('⏰ Service', shiftCheck.message);
          setPin('');
          setLoading(false);
          return;
        }
        router.replace('/waiter-tables');
      } else if (user.role === 'kitchen') {
        router.replace('/kitchen-orders');
      } else if (user.role === 'admin') {
        router.replace('/admin-dashboard');
      } else if (user.role === 'cashier') {
        router.replace('/cashier');
      } else {
        // Fallback for unknown roles
        Alert.alert('Erreur', 'Rôle utilisateur non reconnu');
        setPin('');
        return;
      }
      
    } catch (error) {
      console.error('Authentication error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Erreur de connexion au serveur');
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
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: isSpecial ? '#EF4444' : '#E5E7EB',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      activeOpacity={0.7}
    >
      <Text style={{
        fontSize: typeof value === 'number' ? 28 : 16,
        fontWeight: '600',
        color: isSpecial ? '#EF4444' : '#111827',
      }}>
        {value}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}>
          {/* Header - Logo & Title */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{
              width: 72,
              height: 72,
              backgroundColor: appMode === 'simple' ? '#7C3AED' : '#3B82F6',
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              shadowColor: appMode === 'simple' ? '#7C3AED' : '#3B82F6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}>
              {appMode === 'simple' ? (
                <Text style={{ fontSize: 32 }}>☕</Text>
              ) : (
                <Text style={{ fontSize: 36, fontWeight: '700', color: '#FFFFFF' }}>C</Text>
              )}
            </View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
              CaissaPro
            </Text>
            <Text style={{ fontSize: 15, color: '#6B7280' }}>
              {appMode === 'simple' ? 'Mode Caisse Simple' : 'Mode Complet'}
            </Text>
          </View>

          {/* Mode Toggle */}
          <View style={{ marginBottom: 24 }}>
            <TouchableOpacity
              onPress={toggleMode}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                padding: 4,
              }}
            >
              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: appMode === 'full' ? '#FFFFFF' : 'transparent',
                paddingVertical: 10,
                borderRadius: 10,
                shadowColor: appMode === 'full' ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: appMode === 'full' ? 0.1 : 0,
                shadowRadius: 2,
                elevation: appMode === 'full' ? 2 : 0,
              }}>
                <Utensils size={16} color={appMode === 'full' ? '#3B82F6' : '#9CA3AF'} />
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: appMode === 'full' ? '#3B82F6' : '#9CA3AF',
                }}>
                  Restaurant
                </Text>
              </View>
              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: appMode === 'simple' ? '#FFFFFF' : 'transparent',
                paddingVertical: 10,
                borderRadius: 10,
                shadowColor: appMode === 'simple' ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: appMode === 'simple' ? 0.1 : 0,
                shadowRadius: 2,
                elevation: appMode === 'simple' ? 2 : 0,
              }}>
                <Store size={16} color={appMode === 'simple' ? '#7C3AED' : '#9CA3AF'} />
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: appMode === 'simple' ? '#7C3AED' : '#9CA3AF',
                }}>
                  Café/Comptoir
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* Connection status */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 12,
            }}>
              {isOnline ? (
                <>
                  <Wifi size={14} color="#10B981" />
                  <Text style={{ fontSize: 12, color: '#10B981' }}>En ligne</Text>
                </>
              ) : (
                <>
                  <WifiOff size={14} color="#F59E0B" />
                  <Text style={{ fontSize: 12, color: '#F59E0B' }}>Hors ligne</Text>
                </>
              )}
            </View>
          </View>

          {/* PIN Display */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
              {appMode === 'simple' ? 'Entrez un code (ex: 0000)' : 'Entrez votre code PIN'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[0, 1, 2, 3].map((index) => (
                  <View
                  key={index}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: pin.length > index ? (appMode === 'simple' ? '#7C3AED' : '#3B82F6') : '#E5E7EB',
                    backgroundColor: pin.length > index ? (appMode === 'simple' ? '#F5F3FF' : '#EFF6FF') : '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {pin.length > index && (
                    <View style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: appMode === 'simple' ? '#7C3AED' : '#3B82F6',
                    }} />
                  )}
                </View>
              ))}
            </View>
            {loading && (
              <View style={{ marginTop: 20 }}>
                <ActivityIndicator size="small" color={appMode === 'simple' ? '#7C3AED' : '#3B82F6'} />
              </View>
            )}
          </View>

          {/* Number Pad */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ alignItems: 'center' }}>
              {/* Row 1: 1, 2, 3 */}
              <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                {[1, 2, 3].map((num) => (
                  <React.Fragment key={`num-${num}`}>
                    {renderNumpadButton(num, () => handlePinPress(num.toString()), false, `num-${num}`)}
                  </React.Fragment>
                ))}
              </View>
              
              {/* Row 2: 4, 5, 6 */}
              <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                {[4, 5, 6].map((num) => (
                  <React.Fragment key={`num-${num}`}>
                    {renderNumpadButton(num, () => handlePinPress(num.toString()), false, `num-${num}`)}
                  </React.Fragment>
                ))}
              </View>
              
              {/* Row 3: 7, 8, 9 */}
              <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                {[7, 8, 9].map((num) => (
                  <React.Fragment key={`num-${num}`}>
                    {renderNumpadButton(num, () => handlePinPress(num.toString()), false, `num-${num}`)}
                  </React.Fragment>
                ))}
              </View>
              
              {/* Row 4: CLR, 0, ⌫ */}
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {renderNumpadButton('CLR', handleClear, true, 'clear')}
                {renderNumpadButton(0, () => handlePinPress('0'), false, 'num-0')}
                {renderNumpadButton('⌫', handleBackspace, false, 'backspace')}
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={{ alignItems: 'center', paddingTop: 16 }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
              v1.0.0 • CaissaPro
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}