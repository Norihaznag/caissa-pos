import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Printer, 
  Wifi, 
  Moon, 
  Bell, 
  Globe, 
  Database,
  RefreshCw,
  Trash2,
  Info
} from 'lucide-react-native';

interface SettingItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  type: 'switch' | 'link' | 'action';
  value?: boolean;
  onPress?: () => void;
}

export default function SettingsScreen() {
  const router = useRouter();
  
  const [settings, setSettings] = useState({
    darkMode: false,
    soundNotifications: true,
    autoSync: true,
    offlineMode: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClearCache = () => {
    Alert.alert(
      'Vider le cache',
      'Cette action supprimera les données temporaires. Les commandes hors ligne non synchronisées seront conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Confirmer', 
          style: 'destructive',
          onPress: () => Alert.alert('Cache vidé', 'Le cache a été vidé avec succès.')
        },
      ]
    );
  };

  const handleSyncNow = () => {
    Alert.alert(
      'Synchronisation',
      'Synchronisation en cours...',
      [{ text: 'OK' }]
    );
  };

  const handleConfigurePrinter = () => {
    Alert.alert(
      'Configuration Imprimante',
      'Fonctionnalité à venir.\n\nOptions prévues:\n• Imprimante thermique Bluetooth\n• Imprimante réseau (ESC/POS)\n• Imprimante USB',
      [{ text: 'OK' }]
    );
  };

  const settingSections = [
    {
      title: 'APPARENCE',
      items: [
        {
          id: 'darkMode',
          title: 'Mode sombre',
          subtitle: 'Thème sombre pour l\'application',
          icon: <Moon size={20} color="#6B7280" />,
          type: 'switch' as const,
          value: settings.darkMode,
        },
      ],
    },
    {
      title: 'NOTIFICATIONS',
      items: [
        {
          id: 'soundNotifications',
          title: 'Sons',
          subtitle: 'Notifications sonores pour nouvelles commandes',
          icon: <Bell size={20} color="#6B7280" />,
          type: 'switch' as const,
          value: settings.soundNotifications,
        },
      ],
    },
    {
      title: 'CONNEXION',
      items: [
        {
          id: 'autoSync',
          title: 'Synchronisation automatique',
          subtitle: 'Synchroniser les données automatiquement',
          icon: <RefreshCw size={20} color="#6B7280" />,
          type: 'switch' as const,
          value: settings.autoSync,
        },
        {
          id: 'offlineMode',
          title: 'Mode hors ligne',
          subtitle: 'Forcer le mode hors ligne',
          icon: <Wifi size={20} color="#6B7280" />,
          type: 'switch' as const,
          value: settings.offlineMode,
        },
        {
          id: 'syncNow',
          title: 'Synchroniser maintenant',
          subtitle: 'Forcer la synchronisation des données',
          icon: <Database size={20} color="#3B82F6" />,
          type: 'action' as const,
          onPress: handleSyncNow,
        },
      ],
    },
    {
      title: 'IMPRESSION',
      items: [
        {
          id: 'printer',
          title: 'Configurer l\'imprimante',
          subtitle: 'Bluetooth, Réseau ou USB',
          icon: <Printer size={20} color="#6B7280" />,
          type: 'link' as const,
          onPress: handleConfigurePrinter,
        },
      ],
    },
    {
      title: 'DONNÉES',
      items: [
        {
          id: 'clearCache',
          title: 'Vider le cache',
          subtitle: 'Supprimer les données temporaires',
          icon: <Trash2 size={20} color="#EF4444" />,
          type: 'action' as const,
          onPress: handleClearCache,
        },
      ],
    },
    {
      title: 'À PROPOS',
      items: [
        {
          id: 'version',
          title: 'Version',
          subtitle: 'POS Maroc v1.0.0',
          icon: <Info size={20} color="#6B7280" />,
          type: 'link' as const,
        },
        {
          id: 'language',
          title: 'Langue',
          subtitle: 'Français',
          icon: <Globe size={20} color="#6B7280" />,
          type: 'link' as const,
        },
      ],
    },
  ];

  const renderSettingItem = (item: SettingItem) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => {
        if (item.type === 'switch') {
          toggleSetting(item.id as keyof typeof settings);
        } else if (item.onPress) {
          item.onPress();
        }
      }}
      className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-100"
    >
      <View className="flex-row items-center gap-3 flex-1">
        <View className="w-10 h-10 items-center justify-center bg-gray-100 rounded-lg">
          {item.icon}
        </View>
        <View className="flex-1">
          <Text className="text-base font-medium text-gray-900">{item.title}</Text>
          {item.subtitle && (
            <Text className="text-sm text-gray-500 mt-0.5">{item.subtitle}</Text>
          )}
        </View>
      </View>
      
      {item.type === 'switch' && (
        <Switch
          value={item.value}
          onValueChange={() => toggleSetting(item.id as keyof typeof settings)}
          trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
          thumbColor={item.value ? '#3B82F6' : '#F3F4F6'}
        />
      )}
      
      {item.type === 'link' && (
        <Text className="text-gray-400">›</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Paramètres</Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        {settingSections.map((section) => (
          <View key={section.title} className="mt-6">
            <Text className="px-4 pb-2 text-xs font-semibold text-gray-500">
              {section.title}
            </Text>
            <View className="bg-white border-t border-gray-200">
              {section.items.map(renderSettingItem)}
            </View>
          </View>
        ))}
        
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
