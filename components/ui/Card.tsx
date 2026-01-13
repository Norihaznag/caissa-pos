import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '', onPress }: CardProps) {
  const content = (
    <View className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

Card.Header = function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <View className={`p-4 border-b border-gray-100 ${className}`}>
      {children}
    </View>
  );
};

Card.Title = function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <Text className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </Text>
  );
};

Card.Description = function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <Text className={`text-sm text-gray-500 mt-1 ${className}`}>
      {children}
    </Text>
  );
};

Card.Content = function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <View className={`p-4 ${className}`}>
      {children}
    </View>
  );
};

Card.Footer = function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <View className={`p-4 border-t border-gray-100 flex-row gap-2 ${className}`}>
      {children}
    </View>
  );
};
