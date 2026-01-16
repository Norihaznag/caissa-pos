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
    <View style={{
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      paddingHorizontal: 16,
      paddingVertical: 12,
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
          {showBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                backgroundColor: '#F3F4F6',
              }}
            >
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
          )}
          <View style={{ flexShrink: 1 }}>
            {subtitle && (
              <Text style={{ fontSize: 12, color: '#6B7280' }}>{subtitle}</Text>
            )}
            <Text 
              style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onRefresh && (
            <TouchableOpacity
              onPress={onRefresh}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                backgroundColor: '#F3F4F6',
              }}
            >
              <RefreshCw size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}
          {onLogout && (
            <TouchableOpacity
              onPress={onLogout}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                backgroundColor: '#FEE2E2',
              }}
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
