import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import PINVerifyScreen from './PINVerifyScreen';
import { pinService } from '../../services/pinService';

interface PINLockScreenProps {
  children: React.ReactNode;
}

export default function PINLockScreen({ children }: PINLockScreenProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkPinLock();
  }, []);

  const checkPinLock = async () => {
    try {
      const pinEnabled = await pinService.isPinEnabled();
      const hasPin = await pinService.hasPin();
      
      // Only lock if PIN is enabled AND a PIN is actually set
      setIsLocked(pinEnabled && hasPin);
    } catch (error) {
      console.error('Error checking PIN lock:', error);
      setIsLocked(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  if (isChecking) {
    return null; // Or show a loading spinner
  }

  if (isLocked) {
    return (
      <View style={styles.container}>
        <PINVerifyScreen
          onSuccess={handleUnlock}
          title="App Locked"
          description="Enter your PIN to unlock the app"
        />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
