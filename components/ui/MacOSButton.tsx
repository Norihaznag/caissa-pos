/**
 * MacOSButton.tsx
 * macOS-inspired button with smooth press animations
 * Uses React Native Animated for buttery-smooth interactions
 */

import React, { useRef, useCallback } from 'react';
import {
  Animated,
  Pressable,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'toolbar';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface MacOSButtonProps {
  children?: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticFeedback?: boolean;
}

const variantConfig: Record<ButtonVariant, { bg: string; bgPressed: string; text: string; border: string; borderPressed: string }> = {
  primary: {
    bg: '#007AFF',
    bgPressed: '#005EC4',
    text: '#FFFFFF',
    border: '#006AE6',
    borderPressed: '#004BA0',
  },
  secondary: {
    bg: '#FFFFFF',
    bgPressed: '#E8E8E8',
    text: '#1C1C1E',
    border: '#CFCFCF',
    borderPressed: '#A0A0A0',
  },
  destructive: {
    bg: '#FF3B30',
    bgPressed: '#D32F2F',
    text: '#FFFFFF',
    border: '#E53935',
    borderPressed: '#C62828',
  },
  ghost: {
    bg: 'transparent',
    bgPressed: 'rgba(0,0,0,0.05)',
    text: '#007AFF',
    border: 'transparent',
    borderPressed: 'transparent',
  },
  toolbar: {
    bg: '#FAFAFA',
    bgPressed: '#D8D8D8',
    text: '#4D4D4D',
    border: '#B0B0B0',
    borderPressed: '#909090',
  },
};

const sizeConfig: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number; borderRadius: number; iconSize?: number }> = {
  sm: { height: 28, paddingHorizontal: 12, fontSize: 13, borderRadius: 6 },
  md: { height: 36, paddingHorizontal: 16, fontSize: 14, borderRadius: 8 },
  lg: { height: 44, paddingHorizontal: 20, fontSize: 16, borderRadius: 10 },
  icon: { height: 32, paddingHorizontal: 0, fontSize: 14, borderRadius: 6, iconSize: 32 },
};

export function MacOSButton({
  children,
  onPress,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
  hapticFeedback = true,
}: MacOSButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const config = variantConfig[variant];
  const sizeConf = sizeConfig[size];

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.85,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handlePress = useCallback(() => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [hapticFeedback, onPress]);

  const buttonStyle: ViewStyle = {
    height: size === 'icon' ? sizeConf.iconSize : sizeConf.height,
    width: size === 'icon' ? sizeConf.iconSize : fullWidth ? '100%' : undefined,
    minWidth: size === 'icon' ? sizeConf.iconSize : undefined,
    paddingHorizontal: size === 'icon' ? 0 : sizeConf.paddingHorizontal,
    borderRadius: sizeConf.borderRadius,
    backgroundColor: config.bg,
    borderWidth: 1,
    borderColor: config.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...(disabled && { opacity: 0.5 }),
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        fullWidth && { width: '100%' },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={({ pressed }) => [
          buttonStyle,
          pressed && {
            backgroundColor: config.bgPressed,
            borderColor: config.borderPressed,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : '#007AFF'}
          />
        ) : (
          <>
            {icon && <View>{icon}</View>}
            {children && (
              <Text
                style={[
                  {
                    fontSize: sizeConf.fontSize,
                    fontWeight: '500',
                    color: config.text,
                  },
                  textStyle,
                ]}
              >
                {children}
              </Text>
            )}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * MacOS Loading Indicator
 * A smooth, Apple-style loading component
 */
interface MacOSLoadingProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
}

export function MacOSLoading({ message = 'Chargement...', size = 'large', color = '#007AFF' }: MacOSLoadingProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.loadingContainer}>
      <Animated.View
        style={[
          styles.loadingIconContainer,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View style={[styles.loadingIcon, { shadowColor: color }]}>
          <ActivityIndicator size={size} color={color} />
        </View>
      </Animated.View>
      {message && (
        <Text style={styles.loadingText}>{message}</Text>
      )}
    </View>
  );
}

/**
 * MacOS App Loading Screen
 * Full-screen loading with app branding
 */
interface MacOSAppLoadingProps {
  appName?: string;
  icon?: React.ReactNode;
  message?: string;
  accentColor?: string;
}

export function MacOSAppLoading({
  appName = 'CaissaPro',
  icon,
  message = 'Initialisation...',
  accentColor = '#8B7355',
}: MacOSAppLoadingProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Fade in animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
      }),
    ]).start();

    // Progress bar animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [fadeAnim, scaleAnim, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.appLoadingContainer, { backgroundColor: '#E8E8E8' }]}>
      <Animated.View
        style={[
          styles.appLoadingContent,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* App Icon */}
        <View style={[styles.appIconContainer, { backgroundColor: accentColor }]}>
          {icon}
        </View>

        {/* App Name */}
        <Text style={styles.appName}>{appName}</Text>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              { width: progressWidth, backgroundColor: accentColor },
            ]}
          />
        </View>

        {/* Loading Message */}
        <Text style={styles.loadingMessage}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingIconContainer: {
    marginBottom: 16,
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
  },
  appLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appLoadingContent: {
    alignItems: 'center',
  },
  appIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  progressBarContainer: {
    width: 200,
    height: 4,
    backgroundColor: '#D1D1D6',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  loadingMessage: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
  },
});

export default MacOSButton;
