import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../common/StatusBadge';
import Card from '../common/Card';

interface ExperimentCardProps {
  title: string;
  status: string;
  projectName?: string;
  date?: string;
  onPress: () => void;
}

export default function ExperimentCard({
  title,
  status,
  projectName,
  date,
  onPress,
}: ExperimentCardProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} elevation={1}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
            {title}
          </Text>
          <StatusBadge status={status} size="small" />
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />
      </View>

      {projectName && (
        <View style={styles.infoRow}>
          <Ionicons name="folder-outline" size={14} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {projectName}
          </Text>
        </View>
      )}

      {date && (
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
            {date}
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
    alignItems: 'flex-start',
    marginBottom: 8,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 4,
  },
});
