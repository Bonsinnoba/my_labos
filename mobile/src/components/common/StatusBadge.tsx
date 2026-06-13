import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { statusColors } from '../../utils/theme';

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium' | 'large';
}

export default function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const theme = useTheme();
  
  const getStatusColor = () => {
    const statusLower = status.toLowerCase();
    if (statusLower in statusColors) {
      return statusColors[statusLower as keyof typeof statusColors];
    }
    return theme.colors.primary;
  };

  const backgroundColor = getStatusColor();
  const fontSize = size === 'small' ? 10 : size === 'large' ? 14 : 12;
  const paddingHorizontal = size === 'small' ? 8 : size === 'large' ? 16 : 12;
  const paddingVertical = size === 'small' ? 2 : size === 'large' ? 6 : 4;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor,
          paddingHorizontal,
          paddingVertical,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize, color: 'white' }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
