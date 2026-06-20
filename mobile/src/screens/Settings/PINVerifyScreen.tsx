import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { pinService } from '../../services/pinService';

interface PINVerifyScreenProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
}

export default function PINVerifyScreen({ 
  onSuccess, 
  onCancel, 
  title = 'Enter PIN',
  description = 'Enter your PIN to continue'
}: PINVerifyScreenProps) {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const handlePinInput = (value: string) => {
    if (value.length <= 6 && /^\d*$/.test(value)) {
      setPin(value);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleVerify = async () => {
    if (pin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return;
    }

    setLoading(true);
    const result = await pinService.verifyPin(pin);
    setLoading(false);

    if (result.success) {
      setPin('');
      setError('');
      if (onSuccess) onSuccess();
    } else {
      setError(result.message);
      if (result.attemptsRemaining !== undefined) {
        setAttemptsRemaining(result.attemptsRemaining);
      }
      setPin('');
      
      // If no PIN is set, call onCancel to exit the verify screen
      if (result.message.includes('No PIN set') && onCancel) {
        onCancel();
      }
    }
  };

  React.useEffect(() => {
    if (pin.length === 6) {
      handleVerify();
    }
  }, [pin]);

  const renderPinDots = () => {
    return (
      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              {
                backgroundColor: index < pin.length ? theme.colors.primary : theme.colors.outline,
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
            onPress={() => handlePinInput(pin + num.toString())}
            disabled={loading}
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
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={64} color={theme.colors.primary} />
        </View>

        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Text>

        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          {description}
        </Text>

        {renderPinDots()}

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          </View>
        ) : null}

        {attemptsRemaining !== null && attemptsRemaining <= 2 && !error.includes('locked') ? (
          <View style={styles.warningContainer}>
            <Ionicons name="warning" size={20} color={theme.colors.error} />
            <Text style={[styles.warningText, { color: theme.colors.error }]}>
              {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
            </Text>
          </View>
        ) : null}

        {renderNumberPad()}

        <TouchableOpacity
          style={styles.backspaceButton}
          onPress={handleBackspace}
          disabled={loading}
        >
          <Ionicons name="backspace-outline" size={24} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.primary }]}>
              Cancel
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
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
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
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    marginLeft: 8,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningText: {
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
    marginBottom: 16,
  },
  cancelButton: {
    padding: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
