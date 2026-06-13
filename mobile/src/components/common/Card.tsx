import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Card as PaperCard, useTheme } from 'react-native-paper';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
}

export default function Card({ children, style, onPress, elevation = 1 }: CardProps) {
  const theme = useTheme();

  return (
    <PaperCard
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface },
        style,
      ]}
      onPress={onPress}
      elevation={elevation}
    >
      <View style={styles.content}>{children}</View>
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  content: {
    padding: 16,
  },
});
