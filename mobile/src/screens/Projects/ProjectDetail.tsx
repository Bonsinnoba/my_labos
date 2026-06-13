import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../../components/common/StatusBadge';
import Card from '../../components/common/Card';
import ExperimentCard from '../../components/lists/ExperimentCard';

export default function ProjectDetailScreen({ route, navigation }: any) {
  const theme = useTheme();
  const { projectId } = route.params;
  const [activeTab, setActiveTab] = useState('overview');

  const project = {
    id: projectId,
    name: 'Circuit Analysis',
    description: 'Comprehensive analysis of electronic circuits for power efficiency optimization',
    status: 'Active',
    progress: 75,
    startDate: '2024-01-15',
    lastUpdated: '2 hours ago',
    experiments: [
      { id: 1, title: 'Voltage Stability Test', status: 'COMPLETED', date: '2024-02-01' },
      { id: 2, title: 'Current Measurement', status: 'IN_PROGRESS', date: '2024-02-10' },
      { id: 3, title: 'Thermal Analysis', status: 'PENDING', date: '2024-02-15' },
    ],
    notes: [
      { id: 1, title: 'Initial observations', date: '2024-01-16', content: 'Circuit shows stable voltage output under normal conditions' },
      { id: 2, title: 'Power efficiency findings', date: '2024-01-20', content: 'Efficiency improved by 15% after capacitor replacement' },
    ],
    timeline: [
      { id: 1, event: 'Project started', date: '2024-01-15', type: 'milestone' },
      { id: 2, event: 'First experiment completed', date: '2024-02-01', type: 'experiment' },
      { id: 3, event: 'Mid-term review', date: '2024-02-05', type: 'review' },
    ],
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'information-circle' },
    { id: 'experiments', label: 'Experiments', icon: 'flask' },
    { id: 'notes', label: 'Notes', icon: 'document-text' },
    { id: 'timeline', label: 'Timeline', icon: 'time' },
  ];

  const renderOverview = () => (
    <ScrollView style={styles.tabContent}>
      <Card elevation={0}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Description
          </Text>
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            {project.description}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Progress
          </Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}>
              <View
                style={[styles.progressFill, { backgroundColor: theme.colors.primary, width: `${project.progress}%` }]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.colors.onSurface }]}>
              {project.progress}%
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Details
          </Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Status:</Text>
            <StatusBadge status={project.status} />
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Start Date:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{project.startDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Last Updated:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{project.lastUpdated}</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );

  const renderExperiments = () => (
    <ScrollView style={styles.tabContent}>
      {project.experiments.map((experiment) => (
        <ExperimentCard
          key={experiment.id}
          title={experiment.title}
          status={experiment.status}
          projectName={project.name}
          date={experiment.date}
          onPress={() => console.log('Navigate to experiment')}
        />
      ))}
    </ScrollView>
  );

  const renderNotes = () => (
    <ScrollView style={styles.tabContent}>
      {project.notes.map((note) => (
        <Card key={note.id} elevation={0}>
          <View style={styles.noteHeader}>
            <Text style={[styles.noteTitle, { color: theme.colors.onSurface }]}>{note.title}</Text>
            <Text style={[styles.noteDate, { color: theme.colors.onSurfaceVariant }]}>{note.date}</Text>
          </View>
          <Text style={[styles.noteContent, { color: theme.colors.onSurfaceVariant }]}>
            {note.content}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );

  const renderTimeline = () => (
    <ScrollView style={styles.tabContent}>
      {project.timeline.map((item, index) => (
        <View key={item.id} style={styles.timelineItem}>
          <View style={styles.timelineDot}>
            <View style={[styles.timelineDotInner, { backgroundColor: theme.colors.primary }]} />
          </View>
          <View style={styles.timelineContent}>
            <Text style={[styles.timelineEvent, { color: theme.colors.onSurface }]}>{item.event}</Text>
            <Text style={[styles.timelineDate, { color: theme.colors.onSurfaceVariant }]}>{item.date}</Text>
          </View>
          {index < project.timeline.length - 1 && (
            <View style={[styles.timelineLine, { backgroundColor: theme.colors.border }]} />
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'experiments': return renderExperiments();
      case 'notes': return renderNotes();
      case 'timeline': return renderTimeline();
      default: return renderOverview();
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
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{project.name}</Text>
          <StatusBadge status={project.status} size="small" />
        </View>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.colors.surface }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && { borderBottomColor: theme.colors.primary },
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.id ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab.id ? theme.colors.primary : theme.colors.onSurfaceVariant },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {renderContent()}
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
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  tabs: {
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 40,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  noteHeader: {
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
  },
  noteContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineContent: {
    flex: 1,
  },
  timelineEvent: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 12,
  },
  timelineLine: {
    position: 'absolute',
    left: 11,
    top: 24,
    bottom: -24,
    width: 2,
  },
});
