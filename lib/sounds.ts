// Sound notifications - uses haptic feedback for notifications
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Note: expo-av has been deprecated in SDK 54
// Using expo-haptics for tactile feedback instead
// Audio playback can be added later using expo-audio if needed

// Sound settings storage key
const SOUND_SETTINGS_KEY = 'pos_sound_settings';

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-1
  newOrderSound: boolean;
  kitchenAlertSound: boolean;
  paymentSound: boolean;
}

const defaultSoundSettings: SoundSettings = {
  enabled: true,
  volume: 1.0,
  newOrderSound: true,
  kitchenAlertSound: true,
  paymentSound: true,
};

// Sound cache (for future audio implementation with expo-audio)
let soundCache: { [key: string]: any } = {};

// Save sound settings
export const saveSoundSettings = async (settings: SoundSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving sound settings:', error);
  }
};

// Load sound settings
export const loadSoundSettings = async (): Promise<SoundSettings> => {
  try {
    const data = await AsyncStorage.getItem(SOUND_SETTINGS_KEY);
    return data ? { ...defaultSoundSettings, ...JSON.parse(data) } : defaultSoundSettings;
  } catch (error) {
    console.error('Error loading sound settings:', error);
    return defaultSoundSettings;
  }
};

// Sound types
export type SoundType = 'newOrder' | 'kitchenAlert' | 'payment' | 'success' | 'error' | 'click';

// Initialize audio - placeholder for future expo-audio implementation
export const initAudio = async (): Promise<void> => {
  // Audio initialization will be added when migrating to expo-audio
  // Currently using haptic feedback only
};

// Play a beep pattern for different notifications
export const playBeep = async (
  type: SoundType,
  settings?: SoundSettings
): Promise<void> => {
  const currentSettings = settings || await loadSoundSettings();
  
  if (!currentSettings.enabled) {
    return;
  }

  // Use haptic feedback as primary notification
  switch (type) {
    case 'newOrder':
      if (currentSettings.newOrderSound) {
        // Triple haptic for new order
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await new Promise(resolve => setTimeout(resolve, 150));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await new Promise(resolve => setTimeout(resolve, 150));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      break;
      
    case 'kitchenAlert':
      if (currentSettings.kitchenAlertSound) {
        // Long vibration for kitchen
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await new Promise(resolve => setTimeout(resolve, 200));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      break;
      
    case 'payment':
      if (currentSettings.paymentSound) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      break;
      
    case 'success':
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
      
    case 'error':
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
      
    case 'click':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
  }
};

// Play notification sound with expo-av (if audio files are available)
export const playNotificationSound = async (type: SoundType): Promise<void> => {
  const settings = await loadSoundSettings();
  
  if (!settings.enabled) {
    return;
  }
  
  // First, play haptic feedback
  await playBeep(type, settings);
  
  // Audio file playback can be added here when sound files are available
  // Example:
  // try {
  //   if (!soundCache[type]) {
  //     const { sound } = await Audio.Sound.createAsync(
  //       type === 'newOrder' 
  //         ? require('../assets/sounds/new-order.mp3')
  //         : require('../assets/sounds/notification.mp3')
  //     );
  //     soundCache[type] = sound;
  //   }
  //   
  //   if (soundCache[type]) {
  //     await soundCache[type].setVolumeAsync(settings.volume);
  //     await soundCache[type].replayAsync();
  //   }
  // } catch (error) {
  //   console.error('Error playing sound:', error);
  // }
};

// Cleanup sounds
export const cleanupSounds = async (): Promise<void> => {
  for (const key in soundCache) {
    if (soundCache[key]) {
      try {
        await soundCache[key]!.unloadAsync();
      } catch (error) {
        console.error('Error unloading sound:', error);
      }
    }
  }
  soundCache = {};
};

// Hook for sound notifications in kitchen
import { useEffect, useRef } from 'react';
import { useAppStore } from './store';

export const useNewOrderNotification = () => {
  const orders = useAppStore((state) => state.orders);
  const prevOrdersRef = useRef<string[]>([]);

  useEffect(() => {
    // Defensive check for orders array
    if (!orders || !Array.isArray(orders)) return;
    
    const currentOrderIds = orders
      .filter(o => o && o.status === 'NEW' && !o.isServed)
      .map(o => o.id);
    
    const prevOrderIds = prevOrdersRef.current;
    
    // Check for new orders
    const newOrderIds = currentOrderIds.filter(id => !prevOrderIds.includes(id));
    
    if (newOrderIds.length > 0) {
      // Call async function with catch to prevent unhandled rejection
      playNotificationSound('newOrder').catch(err => 
        console.error('Error playing notification:', err)
      );
    }
    
    prevOrdersRef.current = currentOrderIds;
  }, [orders]);
};

// Hook for order ready notification (for waiters)
export const useOrderReadyNotification = () => {
  const orders = useAppStore((state) => state.orders);
  const prevReadyOrdersRef = useRef<string[]>([]);

  useEffect(() => {
    // Defensive check for orders array
    if (!orders || !Array.isArray(orders)) return;
    
    const readyOrderIds = orders
      .filter(o => o && o.status === 'READY' && !o.isServed)
      .map(o => o.id);
    
    const prevReadyIds = prevReadyOrdersRef.current;
    
    // Check for newly ready orders
    const newReadyIds = readyOrderIds.filter(id => !prevReadyIds.includes(id));
    
    if (newReadyIds.length > 0) {
      // Call async function with catch to prevent unhandled rejection
      playNotificationSound('kitchenAlert').catch(err => 
        console.error('Error playing notification:', err)
      );
    }
    
    prevReadyOrdersRef.current = readyOrderIds;
  }, [orders]);
};
