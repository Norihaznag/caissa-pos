import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: 'bg-gray-100', text: 'text-gray-800' },
  success: { bg: 'bg-green-100', text: 'text-green-800' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  error: { bg: 'bg-red-100', text: 'text-red-800' },
  info: { bg: 'bg-blue-100', text: 'text-blue-800' },
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const styles = variantStyles[variant];
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View className={`${styles.bg} ${padding} rounded-full self-start`}>
      <Text className={`${styles.text} ${textSize} font-semibold`}>
        {children}
      </Text>
    </View>
  );
}
