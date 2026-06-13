import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../../components/common/StatusBadge';
import Card from '../../components/common/Card';

export default function FindingDetailScreen({ route, navigation }: any) {
  const theme = useTheme();
  const { findingId } = route.params;

  const finding = {
    id: findingId,
    title: 'Voltage instability at high load',
    severity: 'HIGH',
    status: 'OPEN',
    experiment: 'Voltage Stability Test',
    date: '2024-02-01',
    description: 'Observed significant voltage drop when load exceeds 80% of rated capacity. This could affect downstream components and requires immediate investigation.',
    rootCause: 'Possible capacitor degradation in the power supply unit',
    recommendedAction: 'Replace capacitors and re-test under full load conditions',
    assignedTo: 'Dr. Smith',
    priority: 'P1',
    relatedExperiments: [
      { id: 1, title: 'Voltage Stability Test', date: '2024-02-01' },
      { id: 2, title: 'Current Measurement', date: '2024-02-10' },
    ],
  };

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
            {finding.title}
          </Text>
        </Card>

        {/* Description */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Description
          </Text>
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            {finding.description}
          </Text>
        </Card>

        {/* Details */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Details
          </Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Status:</Text>
            <StatusBadge status={finding.status} size="small" />
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Priority:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.error }]}>{finding.priority}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Experiment:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.primary }]}>{finding.experiment}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Date:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{finding.date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Assigned to:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{finding.assignedTo}</Text>
          </View>
        </Card>

        {/* Root Cause */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Root Cause
          </Text>
          <Text style={[styles.rootCause, { color: theme.colors.onSurfaceVariant }]}>
            {finding.rootCause}
          </Text>
        </Card>

        {/* Recommended Action */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Recommended Action
          </Text>
          <Text style={[styles.recommendedAction, { color: theme.colors.onSurfaceVariant }]}>
            {finding.recommendedAction}
          </Text>
        </Card>

        {/* Related Experiments */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Related Experiments
          </Text>
          {finding.relatedExperiments.map((exp) => (
            <TouchableOpacity key={exp.id} style={styles.relatedItem}>
              <Ionicons name="flask" size={16} color={theme.colors.primary} />
              <View style={styles.relatedInfo}>
                <Text style={[styles.relatedTitle, { color: theme.colors.onSurface }]}>
                  {exp.title}
                </Text>
                <Text style={[styles.relatedDate, { color: theme.colors.onSurfaceVariant }]}>
                  {exp.date}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => console.log('Mark as resolved')}
          >
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text style={styles.actionButtonText}>Mark Resolved</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => console.log('Assign')}
          >
            <Ionicons name="person-add" size={20} color={theme.colors.onSurface} />
            <Text style={[styles.actionButtonText, { color: theme.colors.onSurface }]}>Assign</Text>
          </TouchableOpacity>
        </View>

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
});
