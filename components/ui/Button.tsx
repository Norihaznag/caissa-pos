import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: 'bg-blue-500', text: 'text-white' },
  secondary: { bg: 'bg-gray-100', text: 'text-gray-900' },
  destructive: { bg: 'bg-red-500', text: 'text-white' },
  outline: { bg: 'bg-white', text: 'text-gray-900', border: 'border border-gray-300' },
  ghost: { bg: 'bg-transparent', text: 'text-gray-900' },
};

const sizeStyles: Record<ButtonSize, { padding: string; text: string }> = {
  sm: { padding: 'px-3 py-2', text: 'text-sm' },
  md: { padding: 'px-4 py-3', text: 'text-base' },
  lg: { padding: 'px-6 py-4', text: 'text-lg' },
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`
        ${styles.bg} 
        ${styles.border || ''} 
        ${sizes.padding} 
        rounded-lg 
        flex-row items-center justify-center gap-2
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50' : ''}
        active:opacity-80
      `}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : '#3B82F6'} />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text className={`${styles.text} ${sizes.text} font-semibold`}>
            {children}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
