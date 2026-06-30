import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import AdvancedSearchBar from '../../components/common/AdvancedSearchBar';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { findingsApi, Finding } from '../../services/api/findings';

export default function FindingsScreen({ navigation }: any) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('All');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFindings();
  }, []);

  const loadFindings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await findingsApi.getAll();
      setFindings(data.findings || []);
    } catch (err) {
      setError('Failed to load findings');
      console.error('Error loading findings:', err);
    } finally {
      setLoading(false);
    }
  };

  const severityFilters = ['All', 'HIGH', 'MEDIUM', 'LOW'];

  const filteredFindings = findings.filter(finding => {
    const matchesSearch = (finding.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterSeverity === 'All' || finding.severity === filterSeverity;
    return matchesSearch && matchesFilter;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return theme.colors.error;
      case 'MEDIUM': return theme.colors.warning;
      case 'LOW': return theme.colors.info;
      default: return theme.colors.primary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Findings
        </Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContent}
      >
        {/* Search */}
        <AdvancedSearchBar
          placeholder="Search findings..."
          onSearch={setSearchQuery}
          showFilters={false}
          debounceMs={300}
        />

        {/* Severity Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {severityFilters.map((severity) => (
            <TouchableOpacity
              key={severity}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filterSeverity === severity ? getSeverityColor(severity) : theme.colors.surface,
                  borderColor: filterSeverity === severity ? getSeverityColor(severity) : theme.colors.border,
                },
              ]}
              onPress={() => setFilterSeverity(severity)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filterSeverity === severity ? 'white' : theme.colors.onSurface },
                ]}
              >
                {severity}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Findings List */}
        <View style={styles.list}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
                Loading findings...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
              <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
                onPress={loadFindings}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredFindings.length > 0 ? (
            filteredFindings.map((finding) => (
              <Card
                key={finding.id}
                elevation={0}
                onPress={() => navigation.navigate('FindingDetail', { findingId: finding.id })}
              >
                <View style={styles.findingHeader}>
                  <View style={styles.findingTitleContainer}>
                  <Text style={[styles.findingTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                    {finding.title || 'Untitled Finding'}
                  </Text>
                  <View style={styles.badgeContainer}>
                    <View
                      style={[
                        styles.severityBadge,
                        { backgroundColor: `${getSeverityColor(finding.severity || 'LOW')}20` },
                      ]}
                    >
                      <Text style={[styles.severityText, { color: getSeverityColor(finding.severity || 'LOW') }]}>
                        {finding.severity || 'LOW'}
                      </Text>
                    </View>
                    <StatusBadge status={finding.status || 'OPEN'} size="small" />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />
              </View>
              <View style={styles.findingInfo}>
                <Ionicons name="calendar" size={14} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
                  {finding.created_at ? new Date(finding.created_at).toLocaleDateString() : 'Unknown'}
                </Text>
              </View>
            </Card>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={64} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No findings found
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
              Try adjusting your search or filters
            </Text>
          </View>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
  },
  scrollContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersScroll: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexGrow: 0,
  },
  filtersContent: {
    paddingRight: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  findingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  findingTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  findingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  findingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
