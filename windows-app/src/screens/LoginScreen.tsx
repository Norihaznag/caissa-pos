/**
 * CaissaPro Windows - Login Screen
 * PIN-based authentication for cashiers
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

// Import shared database
import { databaseService } from '@shared/database/database.windows';

type LoginScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface User {
  id: number;
  username: string;
  role: 'admin' | 'cashier';
}

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavProp>();
  
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize database on mount
  useEffect(() => {
    initializeDatabase();
  }, []);

  const initializeDatabase = async () => {
    try {
      await databaseService.initialize();
      setDbReady(true);
    } catch (err) {
      console.error('Database init error:', err);
      setError('Failed to initialize database');
    }
  };

  const handlePinInput = useCallback((digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
      
      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        handleLogin(newPin);
      }
    }
  }, [pin]);

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setError(null);
  }, []);

  const handleLogin = async (pinCode: string) => {
    if (!dbReady) {
      setError('Database not ready');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Query user by PIN
      const users = await databaseService.query<User>(
        'SELECT id, username, role FROM users WHERE pin = ? AND is_active = 1',
        [pinCode]
      );

      if (users.length === 0) {
        setError('Invalid PIN');
        setPin('');
        return;
      }

      const user = users[0];
      
      // Navigate to main screen with user data
      navigation.reset({
        index: 0,
        routes: [{ 
          name: 'Cashier', 
          params: { 
            userId: user.id, 
            userName: user.username,
            userRole: user.role 
          } 
        }],
      });
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < 4; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.pinDot,
            i < pin.length && styles.pinDotFilled,
            error && styles.pinDotError,
          ]}
        />
      );
    }
    return dots;
  };

  const renderNumpad = () => {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['C', '0', '⌫'],
    ];

    return rows.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.numpadRow}>
        {row.map((key) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.numpadKey,
              (key === 'C' || key === '⌫') && styles.numpadKeyAction,
            ]}
            onPress={() => {
              if (key === 'C') handleClear();
              else if (key === '⌫') handleBackspace();
              else handlePinInput(key);
            }}
            disabled={loading}
          >
            <Text style={[
              styles.numpadKeyText,
              (key === 'C' || key === '⌫') && styles.numpadKeyTextAction,
            ]}>
              {key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    ));
  };

  if (!dbReady && !error) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Initializing CaissaPro...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={styles.content}>
        {/* Logo and Title */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>☕</Text>
          </View>
          <Text style={styles.title}>CaissaPro</Text>
          <Text style={styles.subtitle}>Windows Desktop</Text>
        </View>

        {/* PIN Input Display */}
        <View style={styles.pinContainer}>
          <Text style={styles.pinLabel}>Enter your PIN</Text>
          <View style={styles.pinDotsContainer}>
            {renderPinDots()}
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Numpad */}
        <View style={styles.numpad}>
          {loading ? (
            <ActivityIndicator size="large" color="#2196F3" />
          ) : (
            renderNumpad()
          )}
        </View>

        {/* Version */}
        <Text style={styles.version}>v2.3.0 Windows</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  pinLabel: {
    fontSize: 18,
    color: '#ccc',
    marginBottom: 16,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#555',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  pinDotError: {
    borderColor: '#f44336',
    backgroundColor: pin => pin ? '#f44336' : 'transparent',
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    marginTop: 12,
  },
  numpad: {
    width: 280,
    minHeight: 320,
    justifyContent: 'center',
  },
  numpadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  numpadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  numpadKeyAction: {
    backgroundColor: '#3a3a5a',
  },
  numpadKeyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
  },
  numpadKeyTextAction: {
    fontSize: 24,
    color: '#2196F3',
  },
  version: {
    position: 'absolute',
    bottom: 20,
    color: '#555',
    fontSize: 12,
  },
});
