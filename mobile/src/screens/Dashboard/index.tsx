import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import ProjectCard from '../../components/lists/ProjectCard';
import ExperimentCard from '../../components/lists/ExperimentCard';

export default function DashboardScreen() {
  const theme = useTheme();
  const { isOnline, lastSync } = useAppStore();

  const quickStats = [
    { label: 'Active Projects', value: '3', icon: 'folder', color: theme.colors.primary },
    { label: 'Pending Experiments', value: '5', icon: 'flask', color: theme.colors.warning },
    { label: 'Equipment Available', value: '12', icon: 'build', color: theme.colors.success },
    { label: 'Recent Findings', value: '2', icon: 'search', color: theme.colors.info },
  ];

  const recentActivity = [
    { id: 1, title: 'Project "Circuit Analysis" updated', time: '2 hours ago', type: 'project' },
    { id: 2, title: 'Experiment "Power Test" completed', time: '5 hours ago', type: 'experiment' },
    { id: 3, title: 'New finding added to "Sensor Calibration"', time: '1 day ago', type: 'finding' },
  ];

  const quickActions = [
    { id: 1, title: 'New Experiment', icon: 'flask', color: theme.colors.primary },
    { id: 2, title: 'Add Note', icon: 'create', color: theme.colors.info },
    { id: 3, title: 'Search', icon: 'search', color: theme.colors.warning },
    { id: 4, title: 'Sync Now', icon: 'sync', color: theme.colors.success },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: theme.colors.onSurfaceVariant }]}>
            Welcome back
          </Text>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>
            Dashboard
          </Text>
        </View>
        <View style={[styles.syncStatus, { backgroundColor: isOnline ? theme.colors.success : theme.colors.error }]}>
          <Ionicons 
            name={isOnline ? 'wifi' : 'wifi-outline'} 
            size={16} 
            color="white" 
            style={styles.syncIcon}
          />
          <Text style={styles.syncStatusText}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
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
              onPress={() => console.log(`Action: ${action.title}`)}
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
          <TouchableOpacity>
            <Text style={[styles.seeAll, { color: theme.colors.primary }]}>
              See All
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          <ProjectCard
            name="Circuit Analysis"
            status="Active"
            progress={75}
            lastUpdated="2 hours ago"
            onPress={() => console.log('Navigate to project')}
          />
          <ProjectCard
            name="Sensor Calibration"
            status="Active"
            progress={45}
            lastUpdated="1 day ago"
            onPress={() => console.log('Navigate to project')}
          />
          <ProjectCard
            name="Power Supply Test"
            status="Paused"
            progress={30}
            lastUpdated="3 days ago"
            onPress={() => console.log('Navigate to project')}
          />
        </ScrollView>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Recent Activity
        </Text>
        <Card elevation={0}>
          {recentActivity.map((activity) => (
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
          ))}
        </Card>
      </View>

      {/* Pending Experiments */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Pending Experiments
          </Text>
          <TouchableOpacity>
            <Text style={[styles.seeAll, { color: theme.colors.primary }]}>
              See All
            </Text>
          </TouchableOpacity>
        </View>
        <ExperimentCard
          title="Voltage Stability Test"
          status="PENDING"
          projectName="Circuit Analysis"
          date="Today"
          onPress={() => console.log('Navigate to experiment')}
        />
        <ExperimentCard
          title="Temperature Calibration"
          status="PENDING"
          projectName="Sensor Calibration"
          date="Tomorrow"
          onPress={() => console.log('Navigate to experiment')}
        />
      </View>

      <View style={styles.footer} />
    </ScrollView>
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
  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  syncIcon: {
    marginRight: 4,
  },
  syncStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    marginRight: '2%',
    marginBottom: 8,
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
    flexWrap: 'wrap',
  },
  actionCard: {
    width: '23%',
    marginRight: '2%',
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
  footer: {
    height: 20,
  },
});
