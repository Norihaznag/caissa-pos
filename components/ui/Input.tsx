import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, ...props }: InputProps) {
  return (
    <View className="gap-1">
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      )}
      <TextInput
        className={`
          bg-white border rounded-lg px-4 py-3 text-base text-gray-900
          ${error ? 'border-red-500' : 'border-gray-300'}
        `}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
      {error && (
        <Text className="text-sm text-red-500">{error}</Text>
      )}
      {helperText && !error && (
        <Text className="text-sm text-gray-500">{helperText}</Text>
      )}
    </View>
  );
}
