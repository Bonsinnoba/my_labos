import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { pinService } from '../../services/pinService';

interface PINSetupScreenProps {
  mode?: 'set' | 'change';
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function PINSetupScreen({ onComplete, onCancel }: PINSetupScreenProps) {
  const theme = useTheme();
  const route = useRoute();
  const mode = (route.params as any)?.mode || 'set';
  const [step, setStep] = useState<'enter' | 'confirm' | 'verify_old'>(mode === 'change' ? 'verify_old' : 'enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinInput = (value: string) => {
    if (value.length <= 6 && /^\d*$/.test(value)) {
      if (step === 'enter') {
        setPin(value);
      } else if (step === 'confirm') {
        setConfirmPin(value);
      } else if (step === 'verify_old') {
        setOldPin(value);
      }
      setError('');
    }
  };

  const handleNumberPress = (num: number) => {
    const currentPin = getCurrentPin();
    const newPin = currentPin + num.toString();
    handlePinInput(newPin);
  };

  const handleBackspace = () => {
    if (step === 'enter') {
      setPin(pin.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin(confirmPin.slice(0, -1));
    } else if (step === 'verify_old') {
      setOldPin(oldPin.slice(0, -1));
    }
    setError('');
  };

  const getCurrentPin = () => {
    if (step === 'enter') return pin;
    if (step === 'confirm') return confirmPin;
    if (step === 'verify_old') return oldPin;
    return '';
  };

  const handleNext = async () => {
    const currentPin = getCurrentPin();
    
    if (currentPin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return;
    }

    if (mode === 'change' && step === 'verify_old') {
      setLoading(true);
      const result = await pinService.verifyPin(oldPin);
      setLoading(false);
      
      if (result.success) {
        setStep('enter');
        setPin('');
        // Don't clear oldPin - keep it for the final changePin call
        setError('');
      } else {
        setError(result.message);
      }
    } else if (step === 'enter') {
      setStep('confirm');
      setError('');
    } else if (step === 'confirm') {
      if (pin !== confirmPin) {
        setError('PINs do not match');
        return;
      }

      setLoading(true);
      let result;
      
      if (mode === 'set') {
        result = await pinService.setPin(pin);
      } else {
        result = await pinService.changePin(oldPin, pin);
      }
      
      setLoading(false);
      
      if (result.success) {
        if (onComplete) onComplete();
      } else {
        setError(result.message);
      }
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  const getTitle = () => {
    if (mode === 'change' && step === 'verify_old') return 'Enter Current PIN';
    if (step === 'enter') return mode === 'set' ? 'Set PIN' : 'Enter New PIN';
    if (step === 'confirm') return 'Confirm PIN';
    return 'Set PIN';
  };

  const getDescription = () => {
    if (mode === 'change' && step === 'verify_old') return 'Enter your current PIN to continue';
    if (step === 'enter') return 'Enter a 6-digit PIN for security';
    if (step === 'confirm') return 'Re-enter your PIN to confirm';
    return '';
  };

  const renderPinDots = () => {
    const currentPin = getCurrentPin();
    return (
      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              {
                backgroundColor: index < currentPin.length ? theme.colors.primary : theme.colors.outline,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const renderNumberPad = () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    
    return (
      <View style={styles.numberPad}>
        {numbers.map((num) => (
          <TouchableOpacity
            key={num}
            style={[styles.numberButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => handleNumberPress(num)}
          >
            <Text style={[styles.numberText, { color: theme.colors.onSurface }]}>
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {getTitle()}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          {getDescription()}
        </Text>

        {renderPinDots()}

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          </View>
        ) : null}

        {renderNumberPad()}

        <TouchableOpacity
          style={styles.backspaceButton}
          onPress={handleBackspace}
        >
          <Ionicons name="backspace-outline" size={24} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>

        {getCurrentPin().length === 6 && (
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleNext}
            disabled={loading}
          >
            <Text style={styles.nextButtonText}>
              {loading ? 'Processing...' : step === 'confirm' ? 'Confirm' : 'Next'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 48,
    gap: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    marginLeft: 8,
  },
  numberPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  numberButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    fontSize: 28,
    fontWeight: '600',
  },
  backspaceButton: {
    padding: 12,
    marginBottom: 24,
  },
  nextButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});
