import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../common/StatusBadge';
import Card from '../common/Card';

interface ProjectCardProps {
  name: string;
  status: string;
  progress?: number;
  lastUpdated?: string;
  onPress: () => void;
}

export default function ProjectCard({
  name,
  status,
  progress = 0,
  lastUpdated,
  onPress,
}: ProjectCardProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} elevation={1}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {name}
          </Text>
          <StatusBadge status={status} size="small" />
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />
      </View>

      {progress > 0 && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.colors.primary, width: `${progress}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
            {progress}%
          </Text>
        </View>
      )}

      {lastUpdated && (
        <View style={styles.footer}>
          <Ionicons name="time-outline" size={14} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.lastUpdated, { color: theme.colors.onSurfaceVariant }]}>
            {lastUpdated}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 30,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastUpdated: {
    fontSize: 12,
    marginLeft: 4,
  },
});
