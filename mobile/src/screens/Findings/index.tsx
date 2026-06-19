import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '../../components/common/SearchBar';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';

export default function FindingsScreen({ navigation }: any) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('All');

  const findings = [
    { id: 1, title: 'Voltage instability at high load', severity: 'HIGH', status: 'OPEN', experiment: 'Voltage Stability Test', date: '2024-02-01' },
    { id: 2, title: 'Minor calibration drift detected', severity: 'MEDIUM', status: 'OPEN', experiment: 'Sensor Calibration', date: '2024-01-28' },
    { id: 3, title: 'Unexpected frequency response', severity: 'LOW', status: 'RESOLVED', experiment: 'Frequency Response', date: '2024-01-25' },
    { id: 4, title: 'Thermal hotspot observed', severity: 'HIGH', status: 'IN_PROGRESS', experiment: 'Thermal Analysis', date: '2024-01-20' },
    { id: 5, title: 'Noise level above threshold', severity: 'MEDIUM', status: 'OPEN', experiment: 'Noise Measurement', date: '2024-01-15' },
  ];

  const severityFilters = ['All', 'HIGH', 'MEDIUM', 'LOW'];

  const filteredFindings = findings.filter(finding => {
    const matchesSearch = finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         finding.experiment.toLowerCase().includes(searchQuery.toLowerCase());
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Findings
        </Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <SearchBar
        placeholder="Search findings..."
        onSearch={setSearchQuery}
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
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredFindings.length > 0 ? (
          filteredFindings.map((finding) => (
            <Card
              key={finding.id}
              elevation={0}
              onPress={() => navigation.navigate('FindingDetail', { findingId: finding.id })}
            >
              <View style={styles.findingHeader}>
                <View style={styles.findingTitleContainer}>
                  <Text style={[styles.findingTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                    {finding.title}
                  </Text>
                  <View style={styles.badgeContainer}>
                    <View
                      style={[
                        styles.severityBadge,
                        { backgroundColor: `${getSeverityColor(finding.severity)}20` },
                      ]}
                    >
                      <Text style={[styles.severityText, { color: getSeverityColor(finding.severity) }]}>
                        {finding.severity}
                      </Text>
                    </View>
                    <StatusBadge status={finding.status} size="small" />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />
              </View>
              <View style={styles.findingInfo}>
                <Ionicons name="flask" size={14} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                  {finding.experiment}
                </Text>
              </View>
              <View style={styles.findingInfo}>
                <Ionicons name="calendar" size={14} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
                  {finding.date}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
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
});
