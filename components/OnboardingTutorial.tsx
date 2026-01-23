import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Coffee,
  ShoppingCart,
  CreditCard,
  Grid3x3,
  Settings,
  Wallet,
  Printer,
  Check,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react-native';

const ONBOARDING_KEY = '@caissapro_onboarding_complete';

interface OnboardingStep {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    icon: <Coffee size={48} color="#007AFF" />,
    title: 'Bienvenue sur CaissaPro',
    description: 'Votre système de caisse moderne et intuitif pour restaurants et cafés.',
    tip: 'Cette application fonctionne hors-ligne - vos données sont sécurisées localement.',
  },
  {
    id: 2,
    icon: <ShoppingCart size={48} color="#34C759" />,
    title: 'Ajouter des produits',
    description: 'Appuyez sur un produit pour l\'ajouter au panier. Utilisez les boutons + et - pour modifier les quantités.',
    tip: 'Glissez les catégories pour filtrer vos produits rapidement.',
  },
  {
    id: 3,
    icon: <CreditCard size={48} color="#FF9500" />,
    title: 'Encaisser une commande',
    description: 'Utilisez "Exact" pour un paiement rapide ou "Carte" pour les paiements par carte bancaire.',
    tip: 'Le bouton "Autre montant" permet de saisir un montant personnalisé.',
  },
  {
    id: 4,
    icon: <Grid3x3 size={48} color="#AF52DE" />,
    title: 'Gestion des tables',
    description: 'Sélectionnez une table avant d\'ajouter des produits. "Comptoir" pour les ventes directes.',
    tip: 'Les commandes en attente sont sauvegardées automatiquement.',
  },
  {
    id: 5,
    icon: <Settings size={48} color="#8E8E93" />,
    title: 'Panneau d\'administration',
    description: 'Accédez aux paramètres via l\'icône ⚙️ pour gérer produits, catégories et utilisateurs.',
    tip: 'Seuls les administrateurs peuvent modifier les paramètres.',
  },
  {
    id: 6,
    icon: <Wallet size={48} color="#FF3B30" />,
    title: 'Ouvrir la caisse',
    description: 'Cliquez sur "Ouvrir Caisse" pour démarrer une session. Fermez-la en fin de journée pour le rapport.',
    tip: 'Le rapport de clôture compare le montant compté à l\'attendu.',
  },
  {
    id: 7,
    icon: <Printer size={48} color="#5856D6" />,
    title: 'Impression des reçus',
    description: 'Connectez une imprimante Bluetooth dans les paramètres. Les reçus s\'impriment automatiquement.',
    tip: 'Configurez le design du reçu dans Paramètres > Ticket.',
  },
  {
    id: 8,
    icon: <Sparkles size={48} color="#FFD60A" />,
    title: 'Vous êtes prêt !',
    description: 'CaissaPro est maintenant configuré. Bonne vente !',
    tip: 'Vous pouvez revoir ce tutoriel depuis Paramètres > Aide.',
  },
];

interface OnboardingTutorialProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function OnboardingTutorial({ onComplete, forceShow = false }: OnboardingTutorialProps) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 14,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const checkOnboardingStatus = useCallback(async () => {
    if (forceShow) {
      setVisible(true);
      animateIn();
      return;
    }

    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        setVisible(true);
        animateIn();
      }
    } catch {
      // If error reading, don't show onboarding
    }
  }, [forceShow, animateIn]);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const animateStepChange = useCallback(() => {
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Then fade in
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          speed: 20,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      animateStepChange();
      // Animate progress
      Animated.timing(progressAnim, {
        toValue: (currentStep + 1) / (ONBOARDING_STEPS.length - 1),
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setCurrentStep(0);
      onComplete?.();
    });
  };

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleSkip}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color="#86868B" />
          </TouchableOpacity>

          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>
              {currentStep + 1} / {ONBOARDING_STEPS.length}
            </Text>
          </View>

          {/* Icon */}
          <View style={styles.iconContainer}>
            {step.icon}
          </View>

          {/* Title */}
          <Text style={styles.title}>{step.title}</Text>

          {/* Description */}
          <Text style={styles.description}>{step.description}</Text>

          {/* Tip */}
          {step.tip && (
            <View style={styles.tipContainer}>
              <Text style={styles.tipText}>💡 {step.tip}</Text>
            </View>
          )}

          {/* Progress Dots */}
          <View style={styles.dotsContainer}>
            {ONBOARDING_STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentStep && styles.dotActive,
                  index < currentStep && styles.dotCompleted,
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {!isLastStep && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
              >
                <Text style={styles.skipButtonText}>Passer</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.nextButton,
                isLastStep && styles.nextButtonFull,
              ]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              {isLastStep ? (
                <>
                  <Check size={20} color="#FFFFFF" />
                  <Text style={styles.nextButtonText}>Commencer</Text>
                </>
              ) : (
                <>
                  <Text style={styles.nextButtonText}>Suivant</Text>
                  <ChevronRight size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Static method to reset onboarding (for replaying from settings)
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // Ignore
  }
}

// Static method to check if onboarding was completed
export async function isOnboardingComplete(): Promise<boolean> {
  try {
    const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
    return completed === 'true';
  } catch {
    return true; // Default to completed if error
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1D1D1F',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: '#3C3C43',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  tipContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tipText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5EA',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#007AFF',
  },
  dotCompleted: {
    backgroundColor: '#34C759',
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#86868B',
  },
  nextButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonFull: {
    flex: 1,
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default OnboardingTutorial;
