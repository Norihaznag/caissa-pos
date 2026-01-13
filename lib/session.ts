import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useAppStore } from './store';

const SESSION_KEYS = {
  USER_ROLE: 'user_role',
  USER_NAME: 'user_name',
  USER_PIN: 'user_pin',
  USER_ID: 'user_id',
};

// Hook to manage user session
export const useSession = () => {
  const router = useRouter();
  const { user, login, logout: storeLogout, isAuthenticated } = useAppStore();

  // Load session from AsyncStorage on app start
  const loadSession = useCallback(async () => {
    try {
      const role = await AsyncStorage.getItem(SESSION_KEYS.USER_ROLE);
      const name = await AsyncStorage.getItem(SESSION_KEYS.USER_NAME);
      const pin = await AsyncStorage.getItem(SESSION_KEYS.USER_PIN);
      const id = await AsyncStorage.getItem(SESSION_KEYS.USER_ID);

      if (role && name && pin) {
        login({
          id: id || '',
          name,
          pin,
          role: role as 'admin' | 'waiter' | 'kitchen',
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading session:', error);
      return false;
    }
  }, [login]);

  // Save session to AsyncStorage
  const saveSession = useCallback(async (userData: {
    id: string;
    name: string;
    pin: string;
    role: 'admin' | 'waiter' | 'kitchen';
  }) => {
    try {
      await AsyncStorage.setItem(SESSION_KEYS.USER_ROLE, userData.role);
      await AsyncStorage.setItem(SESSION_KEYS.USER_NAME, userData.name);
      await AsyncStorage.setItem(SESSION_KEYS.USER_PIN, userData.pin);
      await AsyncStorage.setItem(SESSION_KEYS.USER_ID, userData.id);
      
      login(userData);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }, [login]);

  // Clear session and logout
  const logout = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        SESSION_KEYS.USER_ROLE,
        SESSION_KEYS.USER_NAME,
        SESSION_KEYS.USER_PIN,
        SESSION_KEYS.USER_ID,
      ]);
      storeLogout();
      router.replace('/');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }, [storeLogout, router]);

  // Confirm logout with alert
  const confirmLogout = useCallback(() => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  }, [logout]);

  // Navigate to the appropriate screen based on role
  const navigateByRole = useCallback((role: 'admin' | 'waiter' | 'kitchen') => {
    switch (role) {
      case 'admin':
        router.replace('/admin-dashboard');
        break;
      case 'waiter':
        router.replace('/waiter-tables');
        break;
      case 'kitchen':
        router.replace('/kitchen-orders');
        break;
    }
  }, [router]);

  return {
    user,
    isAuthenticated,
    loadSession,
    saveSession,
    logout,
    confirmLogout,
    navigateByRole,
  };
};

// Hook to protect routes based on role
export const useAuthGuard = (allowedRoles: Array<'admin' | 'waiter' | 'kitchen'>) => {
  const router = useRouter();
  const { user, isAuthenticated } = useAppStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    if (user && !allowedRoles.includes(user.role as any)) {
      // User doesn't have permission for this route
      Alert.alert('Accès refusé', 'Vous n\'avez pas accès à cette page.');
      router.back();
    }
  }, [isAuthenticated, user, allowedRoles, router]);

  return { user, isAuthorized: user && allowedRoles.includes(user.role as any) };
};
