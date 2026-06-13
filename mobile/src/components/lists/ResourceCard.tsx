import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';

interface ResourceCardProps {
  title: string;
  type: string;
  size?: string;
  date?: string;
  onPress: () => void;
}

export default function ResourceCard({ title, type, size, date, onPress }: ResourceCardProps) {
  const theme = useTheme();

  const getIcon = () => {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('pdf')) return 'document-text-outline';
    if (typeLower.includes('image') || typeLower.includes('jpg') || typeLower.includes('png')) return 'image-outline';
    if (typeLower.includes('video')) return 'videocam-outline';
    if (typeLower.includes('sheet') || typeLower.includes('excel')) return 'grid-outline';
    return 'document-outline';
  };

  return (
    <Card onPress={onPress} elevation={1}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name={getIcon() as any} size={32} color={theme.colors.primary} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.type, { color: theme.colors.onSurfaceVariant }]}>
              {type.toUpperCase()}
            </Text>
            {size && (
              <>
                <Text style={[styles.separator, { color: theme.colors.onSurfaceVariant }]}>•</Text>
                <Text style={[styles.size, { color: theme.colors.onSurfaceVariant }]}>{size}</Text>
              </>
            )}
          </View>
          {date && (
            <Text style={[styles.date, { color: theme.colors.onSurfaceVariant }]}>
              {date}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  type: {
    fontSize: 11,
    fontWeight: '600',
  },
  separator: {
    fontSize: 11,
    marginHorizontal: 4,
  },
  size: {
    fontSize: 11,
  },
  date: {
    fontSize: 11,
    marginTop: 2,
  },
});
