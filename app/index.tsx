import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions, Animated, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Coffee, Database, Delete } from 'lucide-react-native';
import { useAppStore } from '../lib/store';
import { initOfflineDatabase, offlineUserService } from '../lib/offline-db';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { MacOSAppLoading } from '../components/ui/MacOSButton';

// Animated Numpad Button - macOS style with smooth press animation
interface NumpadButtonProps {
  value: string | number;
  onPress: () => void;
  isSpecial?: boolean;
  disabled?: boolean;
  size: number;
}

function AnimatedNumpadButton({ value, onPress, isSpecial = false, disabled = false, size }: NumpadButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  
  const handlePressIn = () => {
    setPressed(true);
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };
  
  const handlePressOut = () => {
    setPressed(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 6,
    }).start();
  };
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityLabel={typeof value === 'number' ? `Chiffre ${value}` : String(value)}
        accessibilityRole="button"
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: pressed 
            ? (isSpecial ? '#FFD0D0' : '#E8E8E8') 
            : (isSpecial ? '#FFE5E5' : '#FFFFFF'),
          borderWidth: 1,
          borderColor: pressed
            ? (isSpecial ? '#E53935' : '#A0A0A0')
            : (isSpecial ? '#FF3B30' : '#C0C0C0'),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value === '⌫' ? (
          <Delete size={20} color="#666666" />
        ) : (
          <Text style={{
            fontSize: typeof value === 'number' ? 24 : 13,
            fontWeight: '600',
            color: isSpecial ? '#FF3B30' : '#333333',
          }}>
            {value}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const login = useAppStore((state) => state.login);
  const { width, height } = useWindowDimensions();
  
  // Responsive sizing
  const isLandscape = width > height;
  const isTablet = width >= 768;
  const isLargeScreen = width >= 1024;
  
  // Dynamic button sizing
  const numpadButtonSize = isLargeScreen ? 72 : isTablet ? 64 : 56;

  // Lock to landscape mode for tablets
  useEffect(() => {
    const lockLandscape = async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    };
    lockLandscape();
  }, []);

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
    <AnimatedNumpadButton 
      key={key ?? value} 
      value={value} 
      onPress={onPress} 
      isSpecial={isSpecial} 
      disabled={loading}
      size={numpadButtonSize}
    />
  );

  // Show loading screen during initialization - macOS Style
  if (initializing) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <MacOSAppLoading
          appName="CaissaPro"
          icon={<Coffee size={40} color="#FFFFFF" />}
          message="Initialisation..."
          accentColor="#8B7355"
        />
      </SafeAreaView>
    );
  }

  // macOS-inspired Lock Screen
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#E8E8E8' }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Main Container - Horizontal layout for tablets in landscape */}
        <View style={{ 
          flex: 1, 
          flexDirection: isLandscape && isTablet ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isTablet ? 40 : 24,
          gap: isLandscape && isTablet ? 60 : 0,
        }}>
          
          {/* Left/Top Section - Branding */}
          <View style={{ 
            flex: isLandscape && isTablet ? 1 : 0,
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: isLandscape && isTablet ? 0 : 32,
            maxWidth: isLandscape && isTablet ? 400 : undefined,
          }}>
            {/* App Icon - macOS Style */}
            <View style={{
              width: isTablet ? 100 : 80,
              height: isTablet ? 100 : 80,
              backgroundColor: '#007AFF',
              borderRadius: isTablet ? 22 : 18,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              shadowColor: '#007AFF',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 8,
            }}>
              <Coffee size={isTablet ? 50 : 40} color="#FFFFFF" />
            </View>
            
            {/* App Name */}
            <Text style={{ 
              fontSize: isTablet ? 32 : 26, 
              fontWeight: '700', 
              color: '#1D1D1F', 
              marginBottom: 6,
              letterSpacing: -0.5,
            }}>
              CaissaPro
            </Text>
            <Text style={{ 
              fontSize: isTablet ? 16 : 14, 
              color: '#8E8E93',
              fontWeight: '400',
              marginBottom: isLandscape && isTablet ? 24 : 16,
            }}>
              Système de caisse intelligent
            </Text>

            {/* Offline Mode Badge */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#E8F8EB',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: '#B8E6C1',
            }}>
              <Database size={14} color="#34C759" />
              <Text style={{ fontSize: 12, color: '#34C759', fontWeight: '600' }}>
                Mode Hors ligne
              </Text>
            </View>

            {/* Additional info for landscape tablets */}
            {isLandscape && isTablet && (
              <View style={{ marginTop: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#8E8E93', textAlign: 'center', lineHeight: 20 }}>
                  Entrez votre code PIN à 4 chiffres{'\n'}pour accéder à votre caisse
                </Text>
              </View>
            )}
          </View>

          {/* Right/Bottom Section - PIN Entry */}
          <View style={{ 
            flex: isLandscape && isTablet ? 1 : 0,
            alignItems: 'center',
            maxWidth: isLandscape && isTablet ? 360 : undefined,
          }}>
            {/* PIN Card - macOS Window Style */}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 8,
              borderWidth: 1,
              borderColor: '#D0D0D0',
            }}>
              {/* Window Title Bar */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F5F5F5',
                borderBottomWidth: 1,
                borderBottomColor: '#D0D0D0',
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333333' }}>
                  Authentification
                </Text>
              </View>

              {/* PIN Content */}
              <View style={{ padding: isTablet ? 32 : 24, alignItems: 'center' }}>
                {/* PIN Instruction */}
                <Text style={{ fontSize: 14, color: '#8E8E93', marginBottom: 20 }}>
                  Entrez votre code PIN
                </Text>
                
                {/* PIN Dots */}
                <View style={{ flexDirection: 'row', gap: 14, marginBottom: 28 }}>
                  {[0, 1, 2, 3].map((index) => (
                    <View
                      key={index}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: pin.length > index ? '#007AFF' : '#D0D0D0',
                        backgroundColor: pin.length > index ? '#E5F1FF' : '#F8F8F8',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {pin.length > index && (
                        <View style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: '#007AFF',
                        }} />
                      )}
                    </View>
                  ))}
                </View>
                
                {loading && (
                  <View style={{ marginBottom: 20 }}>
                    <ActivityIndicator size="small" color="#007AFF" />
                  </View>
                )}

                {/* Number Pad */}
                <View style={{ gap: 10 }}>
                  {/* Row 1: 1, 2, 3 */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {renderNumpadButton(1, () => handlePinPress('1'))}
                    {renderNumpadButton(2, () => handlePinPress('2'))}
                    {renderNumpadButton(3, () => handlePinPress('3'))}
                  </View>
                  
                  {/* Row 2: 4, 5, 6 */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {renderNumpadButton(4, () => handlePinPress('4'))}
                    {renderNumpadButton(5, () => handlePinPress('5'))}
                    {renderNumpadButton(6, () => handlePinPress('6'))}
                  </View>
                  
                  {/* Row 3: 7, 8, 9 */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {renderNumpadButton(7, () => handlePinPress('7'))}
                    {renderNumpadButton(8, () => handlePinPress('8'))}
                    {renderNumpadButton(9, () => handlePinPress('9'))}
                  </View>
                  
                  {/* Row 4: CLR, 0, ⌫ */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {renderNumpadButton('CLR', handleClear, true)}
                    {renderNumpadButton(0, () => handlePinPress('0'))}
                    {renderNumpadButton('⌫', handleBackspace)}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={{ 
          position: 'absolute', 
          bottom: 20, 
          left: 0, 
          right: 0, 
          alignItems: 'center' 
        }}>
          <Text style={{ fontSize: 12, color: '#8E8E93', fontWeight: '400' }}>
            v1.0.0 • CaissaPro POS
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}