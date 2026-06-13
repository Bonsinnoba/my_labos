import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '../../components/common/SearchBar';
import ResourceCard from '../../components/lists/ResourceCard';

export default function ResourcesScreen({ navigation }: any) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const resources = [
    { id: 1, title: 'Circuit Analysis Report', type: 'PDF', size: '2.4MB', date: '2024-02-01' },
    { id: 2, title: 'Voltage Data CSV', type: 'CSV', size: '156KB', date: '2024-02-01' },
    { id: 3, title: 'Test Setup Photo', type: 'IMAGE', size: '1.2MB', date: '2024-02-01' },
    { id: 4, title: 'Sensor Calibration Guide', type: 'PDF', size: '890KB', date: '2024-01-28' },
    { id: 5, title: 'Frequency Response Data', type: 'CSV', size: '245KB', date: '2024-01-28' },
    { id: 6, title: 'Thermal Analysis Video', type: 'VIDEO', size: '45MB', date: '2024-01-25' },
    { id: 7, title: 'Power Supply Specs', type: 'PDF', size: '1.5MB', date: '2024-01-20' },
    { id: 8, title: 'Equipment Manual', type: 'PDF', size: '3.2MB', date: '2024-01-15' },
  ];

  const typeFilters = ['All', 'PDF', 'CSV', 'IMAGE', 'VIDEO'];

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'All' || resource.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Resources
        </Text>
        <TouchableOpacity
          style={[styles.viewToggle, { backgroundColor: theme.colors.surface }]}
          onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
        >
          <Ionicons
            name={viewMode === 'list' ? 'grid' : 'list'}
            size={20}
            color={theme.colors.onSurface}
          />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <SearchBar
        placeholder="Search resources..."
        onSearch={setSearchQuery}
      />

      {/* Type Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {typeFilters.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterChip,
              {
                backgroundColor: filterType === type ? theme.colors.primary : theme.colors.surface,
                borderColor: filterType === type ? theme.colors.primary : theme.colors.border,
              },
            ]}
            onPress={() => setFilterType(type)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filterType === type ? 'white' : theme.colors.onSurface },
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Resources List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredResources.length > 0 ? (
          filteredResources.map((resource) => (
            <ResourceCard
              key={resource.id}
              title={resource.title}
              type={resource.type}
              size={resource.size}
              date={resource.date}
              onPress={() => navigation.navigate('ResourceDetail', { resourceId: resource.id })}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open" size={64} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No resources found
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
  viewToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
