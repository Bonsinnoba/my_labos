import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../../components/common/StatusBadge';
import Card from '../../components/common/Card';

export default function ExperimentDetailScreen({ route, navigation }: any) {
  const theme = useTheme();
  const { experimentId } = route.params;
  const [activeTab, setActiveTab] = useState('overview');

  const experiment = {
    id: experimentId,
    title: 'Voltage Stability Test',
    status: 'COMPLETED',
    projectName: 'Circuit Analysis',
    date: '2024-02-01',
    description: 'Testing voltage stability under varying load conditions to ensure consistent power delivery',
    expectedOutcome: 'Voltage should remain within ±5% of nominal value',
    actualOutcome: 'Voltage remained within ±3% of nominal value - test passed',
    results: [
      { id: 1, parameter: 'Input Voltage', value: '12.0V', unit: 'V', status: 'PASS' },
      { id: 2, parameter: 'Output Voltage', value: '11.8V', unit: 'V', status: 'PASS' },
      { id: 3, parameter: 'Load Current', value: '2.5A', unit: 'A', status: 'PASS' },
      { id: 4, parameter: 'Efficiency', value: '92%', unit: '%', status: 'PASS' },
    ],
    notes: [
      { id: 1, title: 'Initial setup', date: '2024-02-01 09:00', content: 'Equipment calibrated and connected' },
      { id: 2, title: 'Observation', date: '2024-02-01 10:30', content: 'Voltage drop observed at high load' },
    ],
    attachments: [
      { id: 1, name: 'voltage_data.csv', type: 'CSV', size: '24KB' },
      { id: 2, name: 'test_setup.jpg', type: 'IMAGE', size: '1.2MB' },
      { id: 3, name: 'report.pdf', type: 'PDF', size: '156KB' },
    ],
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'information-circle' },
    { id: 'results', label: 'Results', icon: 'analytics' },
    { id: 'notes', label: 'Notes', icon: 'document-text' },
    { id: 'attachments', label: 'Attachments', icon: 'attach' },
  ];

  const renderOverview = () => (
    <ScrollView style={styles.tabContent}>
      <Card elevation={0}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Description
          </Text>
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            {experiment.description}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Expected Outcome
          </Text>
          <Text style={[styles.outcome, { color: theme.colors.onSurfaceVariant }]}>
            {experiment.expectedOutcome}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Actual Outcome
          </Text>
          <Text style={[styles.outcome, { color: theme.colors.onSurfaceVariant }]}>
            {experiment.actualOutcome}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Details
          </Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Status:</Text>
            <StatusBadge status={experiment.status} />
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Project:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{experiment.projectName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Date:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{experiment.date}</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );

  const renderResults = () => (
    <ScrollView style={styles.tabContent}>
      {experiment.results.map((result) => (
        <Card key={result.id} elevation={0}>
          <View style={styles.resultRow}>
            <View style={styles.resultInfo}>
              <Text style={[styles.resultParameter, { color: theme.colors.onSurface }]}>
                {result.parameter}
              </Text>
              <Text style={[styles.resultValue, { color: theme.colors.onSurface }]}>
                {result.value} {result.unit}
              </Text>
            </View>
            <View
              style={[
                styles.resultStatus,
                { backgroundColor: result.status === 'PASS' ? theme.colors.success : theme.colors.error },
              ]}
            >
              <Text style={styles.resultStatusText}>{result.status}</Text>
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );

  const renderNotes = () => (
    <ScrollView style={styles.tabContent}>
      {experiment.notes.map((note) => (
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

  const renderAttachments = () => (
    <ScrollView style={styles.tabContent}>
      {experiment.attachments.map((attachment) => (
        <Card key={attachment.id} elevation={0} onPress={() => console.log('Open attachment')}>
          <View style={styles.attachmentRow}>
            <View style={[styles.attachmentIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Ionicons
                name={
                  attachment.type === 'CSV' ? 'document-text' :
                  attachment.type === 'IMAGE' ? 'image' :
                  attachment.type === 'PDF' ? 'document' : 'document'
                } as any
                size={24}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.attachmentInfo}>
              <Text style={[styles.attachmentName, { color: theme.colors.onSurface }]}>
                {attachment.name}
              </Text>
              <Text style={[styles.attachmentMeta, { color: theme.colors.onSurfaceVariant }]}>
                {attachment.type} • {attachment.size}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'results': return renderResults();
      case 'notes': return renderNotes();
      case 'attachments': return renderAttachments();
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
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{experiment.title}</Text>
          <StatusBadge status={experiment.status} size="small" />
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
  outcome: {
    fontSize: 14,
    lineHeight: 20,
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
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultParameter: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  resultStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  attachmentMeta: {
    fontSize: 12,
  },
});
