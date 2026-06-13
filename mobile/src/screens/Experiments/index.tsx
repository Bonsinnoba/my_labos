import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '../../components/common/SearchBar';
import ExperimentCard from '../../components/lists/ExperimentCard';

export default function ExperimentsScreen({ navigation }: any) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const experiments = [
    { id: 1, title: 'Voltage Stability Test', status: 'COMPLETED', projectName: 'Circuit Analysis', date: '2024-02-01' },
    { id: 2, title: 'Current Measurement', status: 'IN_PROGRESS', projectName: 'Circuit Analysis', date: '2024-02-10' },
    { id: 3, title: 'Thermal Analysis', status: 'PENDING', projectName: 'Circuit Analysis', date: '2024-02-15' },
    { id: 4, title: 'Frequency Response', status: 'COMPLETED', projectName: 'Sensor Calibration', date: '2024-01-28' },
    { id: 5, title: 'Noise Measurement', status: 'IN_PROGRESS', projectName: 'Sensor Calibration', date: '2024-02-08' },
  ];

  const statusFilters = ['All', 'COMPLETED', 'IN_PROGRESS', 'PENDING', 'FAILED'];

  const filteredExperiments = experiments.filter(experiment => {
    const matchesSearch = experiment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         experiment.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'All' || experiment.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Experiments
        </Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <SearchBar
        placeholder="Search experiments..."
        onSearch={setSearchQuery}
      />

      {/* Status Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {statusFilters.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              {
                backgroundColor: filterStatus === status ? theme.colors.primary : theme.colors.surface,
                borderColor: filterStatus === status ? theme.colors.primary : theme.colors.border,
              },
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filterStatus === status ? 'white' : theme.colors.onSurface },
              ]}
            >
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Experiments List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredExperiments.length > 0 ? (
          filteredExperiments.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              title={experiment.title}
              status={experiment.status}
              projectName={experiment.projectName}
              date={experiment.date}
              onPress={() => navigation.navigate('ExperimentDetail', { experimentId: experiment.id })}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="flask" size={64} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No experiments found
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
