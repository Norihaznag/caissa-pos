import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { 
  Key, 
  AlertCircle, 
  MessageCircle,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LicenseService, LicenseState, getDeviceFingerprint } from '../lib/license/index';
import { LICENSE_CONFIG, formatTrialRemaining } from '../lib/license/config';

interface LicenseGateProps {
  children: React.ReactNode;
}

export default function LicenseGate({ children }: LicenseGateProps) {
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showActivation, setShowActivation] = useState(false);

  const checkLicense = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = await LicenseService.checkLicense();
      setLicenseState(state);
    } catch (error) {
      console.error('License check failed:', error);
      setLicenseState({
        status: 'error',
        deviceId: await getDeviceFingerprint(),
        error: 'Failed to check license',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkLicense();
  }, [checkLicense]);

  const handleActivated = (newState: LicenseState) => {
    setLicenseState(newState);
    setShowActivation(false);
  };

  if (isLoading || !licenseState) {
    return <LoadingScreen />;
  }

  if (licenseState.status === 'licensed') {
    return <>{children}</>;
  }

  if (licenseState.status === 'trial_active') {
    return (
      <>
        {children}
        <TrialBanner 
          timeRemaining={licenseState.trialDaysRemaining || 0} 
          onActivate={() => setShowActivation(true)} 
        />
        {showActivation && (
          <ActivationModal
            deviceId={licenseState.deviceId}
            onClose={() => setShowActivation(false)}
            onActivated={handleActivated}
          />
        )}
      </>
    );
  }

  return (
    <ExpiredScreen 
      licenseState={licenseState} 
      onRetry={checkLicense}
      onActivated={handleActivated}
    />
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          backgroundColor: '#1C1C1E',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}>
          <Text style={{ fontSize: 40 }}>🧾</Text>
        </View>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={{ marginTop: 16, color: '#86868B', fontSize: 15 }}>
          Checking license...
        </Text>
      </View>
    </SafeAreaView>
  );
}

interface TrialBannerProps {
  timeRemaining: number;
  onActivate: () => void;
}

function TrialBanner({ timeRemaining, onActivate }: TrialBannerProps) {
  const isUrgent = timeRemaining <= 2;
  
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onActivate();
      }}
      activeOpacity={0.8}
      style={{
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 80,
        left: 20,
        right: 20,
        backgroundColor: isUrgent ? '#FF453A' : '#1C1C1E',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: isUrgent ? '#FF453A' : '#38383A',
      }}
    >
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: isUrgent ? 'rgba(255,255,255,0.2)' : '#2C2C2E',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
      }}>
        <Clock size={18} color={isUrgent ? '#FFF' : '#FF9F0A'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
          {formatTrialRemaining(timeRemaining)} remaining
        </Text>
        <Text style={{ color: isUrgent ? 'rgba(255,255,255,0.7)' : '#86868B', fontSize: 12, marginTop: 2 }}>
          Tap to activate license
        </Text>
      </View>
      <View style={{
        backgroundColor: isUrgent ? '#FFF' : '#FF9F0A',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
      }}>
        <Text style={{ color: isUrgent ? '#FF453A' : '#000', fontSize: 12, fontWeight: '600' }}>
          Activate
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface ActivationModalProps {
  deviceId: string;
  onClose: () => void;
  onActivated: (state: LicenseState) => void;
}

function ActivationModal({ deviceId, onClose, onActivated }: ActivationModalProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const formatLicenseKey = (value: string): string => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const parts: string[] = [];
    for (let i = 0; i < cleaned.length && i < 16; i += 4) {
      parts.push(cleaned.substring(i, i + 4));
    }
    return parts.join('-');
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await LicenseService.activateLicense(licenseKey);
      if (result.success && result.licenseState) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onActivated(result.licenseState);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(result.message);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Connection error. Check your internet.');
    }
    setLoading(false);
  };

  const copyDeviceId = async () => {
    await Clipboard.setStringAsync(deviceId);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = `Hi! I want to buy CaissaPro license.%0A%0ADevice ID: ${deviceId}`;
    Linking.openURL(`https://wa.me/${LICENSE_CONFIG.WHATSAPP_NUMBER}?text=${message}`);
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 36, height: 5, backgroundColor: '#48484A', borderRadius: 3 }} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 20, maxHeight: 500 }}>
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: '#FF9F0A', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Key size={28} color="#000" />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 6 }}>Activate License</Text>
              <Text style={{ fontSize: 15, color: '#86868B', textAlign: 'center' }}>
                {LICENSE_CONFIG.SUBSCRIPTION.price} {LICENSE_CONFIG.CURRENCY} / year
              </Text>
            </View>
            <View style={{ backgroundColor: '#2C2C2E', borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <Text style={{ fontSize: 12, color: '#86868B', marginBottom: 8 }}>YOUR DEVICE ID</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 15, color: '#FFF', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{deviceId}</Text>
                <TouchableOpacity onPress={copyDeviceId} style={{ padding: 8, backgroundColor: '#3A3A3C', borderRadius: 8 }}>
                  {copied ? <Check size={16} color="#30D158" /> : <Copy size={16} color="#86868B" />}
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#86868B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>License Key</Text>
              <TextInput
                value={licenseKey}
                onChangeText={(text) => { setLicenseKey(formatLicenseKey(text)); setError(''); }}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor="#48484A"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={19}
                editable={!loading}
                style={{ fontSize: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 2, textAlign: 'center', padding: 16, backgroundColor: '#2C2C2E', borderRadius: 12, borderWidth: 2, borderColor: error ? '#FF453A' : '#3A3A3C', color: '#FFF' }}
              />
            </View>
            {error ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,69,58,0.15)', borderRadius: 10, marginBottom: 16 }}>
                <AlertCircle size={16} color="#FF453A" />
                <Text style={{ marginLeft: 8, color: '#FF453A', fontSize: 14 }}>{error}</Text>
              </View>
            ) : null}
            <TouchableOpacity onPress={handleActivate} disabled={loading || !licenseKey.trim()} activeOpacity={0.8} style={{ backgroundColor: loading || !licenseKey.trim() ? '#3A3A3C' : '#FF9F0A', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              {loading ? <ActivityIndicator color="#000" /> : (
                <>
                  <Zap size={18} color={licenseKey.trim() ? '#000' : '#86868B'} />
                  <Text style={{ marginLeft: 8, color: licenseKey.trim() ? '#000' : '#86868B', fontSize: 16, fontWeight: '600' }}>Activate</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={openWhatsApp} activeOpacity={0.8} style={{ backgroundColor: '#30D158', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <MessageCircle size={18} color="#000" />
              <Text style={{ marginLeft: 8, color: '#000', fontSize: 16, fontWeight: '600' }}>Buy via WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.6} style={{ padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#86868B', fontSize: 15 }}>Continue Trial</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

interface ExpiredScreenProps {
  licenseState: LicenseState;
  onRetry: () => void;
  onActivated: (state: LicenseState) => void;
}

function ExpiredScreen({ licenseState, onRetry, onActivated }: ExpiredScreenProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const formatLicenseKey = (value: string): string => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const parts: string[] = [];
    for (let i = 0; i < cleaned.length && i < 16; i += 4) {
      parts.push(cleaned.substring(i, i + 4));
    }
    return parts.join('-');
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await LicenseService.activateLicense(licenseKey);
      if (result.success && result.licenseState) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onActivated(result.licenseState);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(result.message);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Connection error. Check your internet.');
    }
    setLoading(false);
  };

  const copyDeviceId = async () => {
    await Clipboard.setStringAsync(licenseState.deviceId);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = `Hi! I want to buy CaissaPro license.%0A%0ADevice ID: ${licenseState.deviceId}`;
    Linking.openURL(`https://wa.me/${LICENSE_CONFIG.WHATSAPP_NUMBER}?text=${message}`);
  };

  const getStatusInfo = () => {
    switch (licenseState.status) {
      case 'trial_expired': return { emoji: '⏰', title: 'Trial Ended', subtitle: 'Your free trial has expired' };
      case 'expired': return { emoji: '📅', title: 'License Expired', subtitle: 'Renew to continue using CaissaPro' };
      case 'suspended': return { emoji: '🔒', title: 'License Suspended', subtitle: 'Contact support for help' };
      case 'error': return { emoji: '📡', title: 'No Connection', subtitle: 'Please check your internet' };
      default: return { emoji: '🔑', title: 'Activation Required', subtitle: 'Enter your license key' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 40 }}>{statusInfo.emoji}</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#FFF', marginBottom: 8, textAlign: 'center' }}>{statusInfo.title}</Text>
            <Text style={{ fontSize: 16, color: '#86868B', textAlign: 'center' }}>{statusInfo.subtitle}</Text>
          </View>
          {licenseState.status === 'error' && (
            <TouchableOpacity onPress={onRetry} activeOpacity={0.8} style={{ backgroundColor: '#2C2C2E', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <RefreshCw size={18} color="#FFF" />
              <Text style={{ marginLeft: 8, color: '#FFF', fontSize: 16, fontWeight: '500' }}>Try Again</Text>
            </TouchableOpacity>
          )}
          <View style={{ backgroundColor: '#1C1C1E', borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <Text style={{ fontSize: 11, color: '#86868B', marginBottom: 8, letterSpacing: 1 }}>YOUR DEVICE ID</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 14, color: '#FFF', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{licenseState.deviceId}</Text>
              <TouchableOpacity onPress={copyDeviceId} style={{ padding: 8, backgroundColor: '#2C2C2E', borderRadius: 8 }}>
                {copied ? <Check size={16} color="#30D158" /> : <Copy size={16} color="#86868B" />}
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 11, color: '#86868B', marginBottom: 8, letterSpacing: 1 }}>LICENSE KEY</Text>
            <TextInput
              value={licenseKey}
              onChangeText={(text) => { setLicenseKey(formatLicenseKey(text)); setError(''); }}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor="#48484A"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={19}
              editable={!loading}
              style={{ fontSize: 22, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 3, textAlign: 'center', padding: 18, backgroundColor: '#1C1C1E', borderRadius: 12, borderWidth: 2, borderColor: error ? '#FF453A' : '#2C2C2E', color: '#FFF' }}
            />
          </View>
          {error ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,69,58,0.15)', borderRadius: 10, marginBottom: 16 }}>
              <AlertCircle size={16} color="#FF453A" />
              <Text style={{ marginLeft: 8, color: '#FF453A', fontSize: 14 }}>{error}</Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={handleActivate} disabled={loading || !licenseKey.trim()} activeOpacity={0.8} style={{ backgroundColor: loading || !licenseKey.trim() ? '#2C2C2E' : '#FF9F0A', padding: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            {loading ? <ActivityIndicator color={licenseKey.trim() ? '#000' : '#86868B'} /> : (
              <>
                <Zap size={20} color={licenseKey.trim() ? '#000' : '#86868B'} />
                <Text style={{ marginLeft: 8, color: licenseKey.trim() ? '#000' : '#86868B', fontSize: 17, fontWeight: '600' }}>Activate License</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#2C2C2E' }} />
            <Text style={{ color: '#48484A', marginHorizontal: 16, fontSize: 13 }}>Don't have a license?</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#2C2C2E' }} />
          </View>
          <TouchableOpacity onPress={openWhatsApp} activeOpacity={0.8} style={{ backgroundColor: '#30D158', padding: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle size={20} color="#000" />
            <Text style={{ marginLeft: 8, color: '#000', fontSize: 17, fontWeight: '600' }}>Buy via WhatsApp</Text>
          </TouchableOpacity>
          <Text style={{ textAlign: 'center', color: '#86868B', marginTop: 16, fontSize: 14 }}>
            {LICENSE_CONFIG.SUBSCRIPTION.price} {LICENSE_CONFIG.CURRENCY} / year
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
