import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '../lib/store';
import * as Haptics from 'expo-haptics';

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const login = useAppStore((state) => state.login);

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

  const handleLogin = async (pinCode: string) => {
    setLoading(true);
    
    try {
      // TODO: Replace with actual Supabase authentication
      // For now, demo authentication:
      // PIN 1111 = Admin
      // PIN 2222 = Waiter
      // PIN 3333 = Kitchen
      
      let role: 'admin' | 'waiter' | 'kitchen' | null = null;
      let userName = '';
      
      if (pinCode === '1111') {
        role = 'admin';
        userName = 'Admin';
      } else if (pinCode === '2222') {
        role = 'waiter';
        userName = 'Serveur';
      } else if (pinCode === '3333') {
        role = 'kitchen';
        userName = 'Cuisine';
      } else {
        Alert.alert('Erreur', 'Code PIN incorrect');
        setPin('');
        setLoading(false);
        return;
      }
      
      // Use Zustand store for login
      login({
        id: `user-${pinCode}`,
        name: userName,
        pin: pinCode,
        role: role,
      });
      
      // Navigate based on role
      if (role === 'waiter') {
        router.replace('/waiter-tables');
      } else if (role === 'kitchen') {
        router.replace('/kitchen-orders');
      } else if (role === 'admin') {
        router.replace('/admin-dashboard');
      }
      
    } catch (error) {
      Alert.alert('Erreur', 'Erreur de connexion');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-8">
        {/* Header */}
        <View className="items-center mb-12">
          <View className="w-20 h-20 bg-blue-500 rounded-2xl items-center justify-center mb-4 shadow-lg">
            <Text className="text-4xl font-bold text-white">C</Text>
          </View>
          <Text className="text-3xl font-bold text-gray-900 mb-1">CaissaPro</Text>
          <Text className="text-base text-gray-500">Système de caisse intelligent</Text>
        </View>

        {/* PIN Display */}
        <View className="items-center mb-12">
          <Text className="text-sm text-gray-600 mb-4">Entrez votre code PIN</Text>
          <View className="flex-row gap-3">
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                className="w-14 h-14 rounded-lg border-2 border-gray-300 items-center justify-center bg-white"
              >
                {pin.length > index && (
                  <View className="w-3 h-3 rounded-full bg-blue-500" />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Number Pad */}
        <View className="flex-1 max-w-sm mx-auto w-full">
          <View className="flex-row flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <TouchableOpacity
                key={num}
                onPress={() => handlePinPress(num.toString())}
                disabled={loading}
                accessibilityLabel={`Chiffre ${num}`}
                accessibilityRole="button"
                className="basis-[30%] aspect-square items-center justify-center bg-white border-2 border-gray-300 rounded-lg active:bg-gray-100"
              >
                <Text className="text-3xl font-semibold text-gray-900">{num}</Text>
              </TouchableOpacity>
            ))}
            
            {/* Clear Button */}
            <TouchableOpacity
              onPress={handleClear}
              disabled={loading}
              accessibilityLabel="Effacer le code PIN"
              accessibilityRole="button"
              className="basis-[30%] aspect-square items-center justify-center bg-white border-2 border-gray-300 rounded-lg active:bg-gray-100"
            >
              <Text className="text-lg font-semibold text-red-600">CLR</Text>
            </TouchableOpacity>
            
            {/* Zero */}
            <TouchableOpacity
              onPress={() => handlePinPress('0')}
              disabled={loading}
              className="basis-[30%] aspect-square items-center justify-center bg-white border-2 border-gray-300 rounded-lg active:bg-gray-100"
            >
              <Text className="text-3xl font-semibold text-gray-900">0</Text>
            </TouchableOpacity>
            
            {/* Empty space for alignment */}
            <View className="basis-[30%] aspect-square" />
          </View>
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View className="items-center mt-6">
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        )}

        {/* Demo Info */}
        <View className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Text className="text-xs text-blue-900 font-semibold mb-2">DEMO:</Text>
          <Text className="text-xs text-blue-800">1111 = Admin</Text>
          <Text className="text-xs text-blue-800">2222 = Serveur</Text>
          <Text className="text-xs text-blue-800">3333 = Cuisine</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}