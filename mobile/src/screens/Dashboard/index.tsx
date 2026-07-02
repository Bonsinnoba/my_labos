import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import ProjectCard from '../../components/lists/ProjectCard';
import ExperimentCard from '../../components/lists/ExperimentCard';
import { projectsApi, Project } from '../../services/api/projects';
import { experimentsApi, Experiment } from '../../services/api/experiments';

export default function DashboardScreen({ navigation }: any) {
  const theme = useTheme();
  const { isOnline, lastSync } = useAppStore();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeProjects: 0,
    pendingExperiments: 0,
    equipmentAvailable: 0,
    recentFindings: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [projectsData, experimentsData] = await Promise.all([
        projectsApi.getAll(),
        experimentsApi.getAll(),
      ]);
      
      setProjects(projectsData.slice(0, 3)); // Show recent 3 projects
      setExperiments(experimentsData.slice(0, 2)); // Show recent 2 experiments
      
      // Calculate stats from real data
      setStats({
        activeProjects: projectsData.filter(p => p.status === 'Active').length,
        pendingExperiments: experimentsData.filter(e => e.status === 'PENDING').length,
        equipmentAvailable: 0, // TODO: Fetch from equipment API when available
        recentFindings: 0, // TODO: Fetch from findings API when available
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickStats = [
    { label: 'Active Projects', value: stats.activeProjects.toString(), icon: 'folder', color: theme.colors.primary },
    { label: 'Pending Experiments', value: stats.pendingExperiments.toString(), icon: 'flask', color: theme.colors.warning },
    { label: 'Equipment Available', value: stats.equipmentAvailable.toString(), icon: 'build', color: theme.colors.success },
    { label: 'Recent Findings', value: stats.recentFindings.toString(), icon: 'search', color: theme.colors.info },
  ];

  const recentActivity = [];

  const quickActions = [
    { id: 1, title: 'Add Note', icon: 'create', color: theme.colors.info },
    { id: 2, title: 'Search', icon: 'search', color: theme.colors.warning },
    { id: 3, title: 'Resources', icon: 'document', color: theme.colors.primary },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Dashboard
        </Text>
        <View style={styles.syncStatus}>
          <Ionicons
            name={isOnline ? 'wifi' : 'wifi-outline'}
            size={20}
            color={isOnline ? '#4CAF50' : '#FF9800'}
            style={styles.syncIcon}
          />
          <Text style={[styles.syncStatusText, { color: isOnline ? '#4CAF50' : '#FF9800' }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContent}
      >
        {/* Welcome Greeting */}
        <View style={styles.greetingContainer}>
          <Text style={[styles.greeting, { color: theme.colors.onSurfaceVariant }]}>
            Welcome back
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          {quickStats.map((stat, index) => (
            <Card key={index} style={styles.statCard} elevation={0}>
              <View style={styles.statContent}>
                <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                  <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                </View>
                <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {stat.label}
                </Text>
              </View>
            </Card>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Quick Actions
          </Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  if (action.title === 'Add Note') {
                    navigation.navigate('Notebook');
                  } else if (action.title === 'Search') {
                    navigation.navigate('Search');
                  } else if (action.title === 'Resources') {
                    navigation.navigate('Resources');
                  }
                }}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${action.color}20` }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={[styles.actionTitle, { color: theme.colors.onSurface }]}>
                  {action.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Projects */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Recent Projects
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Projects')}>
              <Text style={[styles.seeAll, { color: theme.colors.primary }]}>
                See All
              </Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : projects.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  name={project.name}
                  status={project.status}
                  progress={0}
                  lastUpdated={project.updated_at ? new Date(project.updated_at).toLocaleDateString() : 'Unknown'}
                  onPress={() => navigation.navigate('ProjectDetail', { projectId: project.id })}
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No projects yet
            </Text>
          )}
        </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Recent Activity
        </Text>
        <Card elevation={0}>
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
              <View key={activity.id} style={[styles.activityItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.activityIcon}>
                  <Ionicons 
                    name={
                      activity.type === 'project' ? 'folder' :
                      activity.type === 'experiment' ? 'flask' : 'search'
                    } as any
                    size={20} 
                    color={theme.colors.primary} 
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityTitle, { color: theme.colors.onSurface }]}>
                    {activity.title}
                  </Text>
                  <Text style={[styles.activityTime, { color: theme.colors.onSurfaceVariant }]}>
                    {activity.time}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant, padding: 16 }]}>
              No recent activity
            </Text>
          )}
        </Card>
      </View>

      {/* Pending Experiments */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Pending Experiments
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Experiments')}>
            <Text style={[styles.seeAll, { color: theme.colors.primary }]}>
              See All
            </Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : experiments.length > 0 ? (
          experiments.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              title={experiment.log_title || 'Untitled Experiment'}
              status={experiment.status || 'PENDING'}
              projectName={experiment.project_name || 'Unknown Project'}
              date={experiment.timestamp ? new Date(experiment.timestamp).toLocaleDateString() : 'Unknown'}
              onPress={() => navigation.navigate('ExperimentDetail', { experimentId: experiment.id })}
            />
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No experiments yet
          </Text>
        )}
      </View>

      <View style={styles.footer} />
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
  greetingContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncIcon: {
    marginRight: 4,
  },
  syncStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  statCard: {
    width: '48%',
    marginHorizontal: 0,  // override Card component's built-in marginHorizontal: 16
    marginBottom: 0,      // gap handles spacing instead
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  actionCard: {
    flex: 1,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  horizontalScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  footer: {
    height: 20,
  },
});
