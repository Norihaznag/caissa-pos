import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ArrowLeft, RefreshCw, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onRefresh?: () => void;
  onLogout?: () => void;
  rightContent?: React.ReactNode;
}

export function Header({ 
  title, 
  subtitle, 
  showBack = false, 
  onRefresh, 
  onLogout,
  rightContent 
}: HeaderProps) {
  const router = useRouter();

  return (
    <View className="bg-white border-b border-gray-200 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {showBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center rounded-lg bg-gray-100"
            >
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
          )}
          <View>
            {subtitle && (
              <Text className="text-xs text-gray-500">{subtitle}</Text>
            )}
            <Text className="text-xl font-bold text-gray-900">{title}</Text>
          </View>
        </View>
        
        <View className="flex-row items-center gap-2">
          {onRefresh && (
            <TouchableOpacity
              onPress={onRefresh}
              className="w-10 h-10 items-center justify-center rounded-lg bg-gray-100"
            >
              <RefreshCw size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}
          {onLogout && (
            <TouchableOpacity
              onPress={onLogout}
              className="w-10 h-10 items-center justify-center rounded-lg bg-gray-100"
            >
              <LogOut size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
          {rightContent}
        </View>
      </View>
    </View>
  );
}
