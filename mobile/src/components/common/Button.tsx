import React from 'react';
import { View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Button as PaperButton, useTheme } from 'react-native-paper';

interface ButtonProps {
  title: string;
  onPress: () => void;
  mode?: 'text' | 'contained' | 'outlined' | 'elevated' | 'contained-tonal';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  mode = 'contained',
  icon,
  disabled = false,
  loading = false,
  style,
  labelStyle,
}: ButtonProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      <PaperButton
        mode={mode}
        onPress={onPress}
        icon={icon ? () => <Ionicons name={icon as any} size={20} color="white" /> : undefined}
        disabled={disabled}
        loading={loading}
        style={[styles.button, { backgroundColor: mode === 'contained' ? theme.colors.primary : undefined }]}
        labelStyle={[styles.label, labelStyle]}
        contentStyle={styles.content}
      >
        {title}
      </PaperButton>
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  button: {
    borderRadius: 8,
  },
  label: {
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  content: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
