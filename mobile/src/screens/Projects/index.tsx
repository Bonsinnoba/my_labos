import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '../../components/common/SearchBar';
import StatusBadge from '../../components/common/StatusBadge';
import ProjectCard from '../../components/lists/ProjectCard';

export default function ProjectsScreen({ navigation }: any) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const projects = [
    { id: 1, name: 'Circuit Analysis', status: 'Active', progress: 75, lastUpdated: '2 hours ago' },
    { id: 2, name: 'Sensor Calibration', status: 'Active', progress: 45, lastUpdated: '1 day ago' },
    { id: 3, name: 'Power Supply Test', status: 'Paused', progress: 30, lastUpdated: '3 days ago' },
    { id: 4, name: 'Thermal Analysis', status: 'Completed', progress: 100, lastUpdated: '1 week ago' },
    { id: 5, name: 'Signal Processing', status: 'Active', progress: 60, lastUpdated: '5 hours ago' },
  ];

  const statusFilters = ['All', 'Active', 'Completed', 'Paused'];

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'All' || project.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Projects
        </Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <SearchBar
        placeholder="Search projects..."
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

      {/* Projects List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              name={project.name}
              status={project.status}
              progress={project.progress}
              lastUpdated={project.lastUpdated}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: project.id })}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open" size={64} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No projects found
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
