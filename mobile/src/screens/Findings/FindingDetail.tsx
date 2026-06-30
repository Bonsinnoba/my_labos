import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../../components/common/StatusBadge';
import Card from '../../components/common/Card';
import { findingsApi, Finding } from '../../services/api/findings';

export default function FindingDetailScreen({ route, navigation }: any) {
  const theme = useTheme();
  const { findingId } = route.params;
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinding();
  }, [findingId]);

  const loadFinding = async () => {
    try {
      setLoading(true);
      const data = await findingsApi.getById(findingId);
      setFinding(data);
    } catch (error) {
      console.error('Error loading finding:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Finding</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!finding) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Finding</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>
            Finding not found
          </Text>
        </View>
      </View>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return theme.colors.error;
      case 'MEDIUM': return theme.colors.warning;
      case 'LOW': return theme.colors.info;
      default: return theme.colors.primary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Finding Details</Text>
        </View>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Severity & Status */}
        <Card elevation={0}>
          <View style={styles.badgeRow}>
            <View
              style={[styles.severityBadgeLarge, { backgroundColor: `${getSeverityColor(finding.severity)}20` }]}
            >
              <Ionicons
                name={
                  finding.severity === 'HIGH' ? 'warning' :
                  finding.severity === 'MEDIUM' ? 'alert-circle' : 'information-circle'
                } as any
                size={24}
                color={getSeverityColor(finding.severity)}
              />
              <Text style={[styles.severityTextLarge, { color: getSeverityColor(finding.severity) }]}>
                {finding.severity} Severity
              </Text>
            </View>
            <StatusBadge status={finding.status} />
          </View>
        </Card>

        {/* Title */}
        <Card elevation={0}>
          <Text style={[styles.findingTitle, { color: theme.colors.onSurface }]}>
            {finding.title || 'Untitled Finding'}
          </Text>
        </Card>

        {/* Description */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Description
          </Text>
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            {finding.description || 'No description available'}
          </Text>
        </Card>

        {/* Details */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Details
          </Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Status:</Text>
            <StatusBadge status={finding.status || 'OPEN'} size="small" />
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Severity:</Text>
            <Text style={[styles.detailValue, { color: getSeverityColor(finding.severity || 'LOW') }]}>{finding.severity || 'LOW'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Date:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
              {finding.created_at ? new Date(finding.created_at).toLocaleDateString() : 'Unknown'}
            </Text>
          </View>
        </Card>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severityBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  severityTextLarge: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  findingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  rootCause: {
    fontSize: 14,
    lineHeight: 20,
  },
  recommendedAction: {
    fontSize: 14,
    lineHeight: 20,
  },
  relatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  relatedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  relatedTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  relatedDate: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    height: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
});
