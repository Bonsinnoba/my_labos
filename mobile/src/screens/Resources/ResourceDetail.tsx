import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';

export default function ResourceDetailScreen({ route, navigation }: any) {
  const theme = useTheme();
  const { resourceId } = route.params;

  const resource = {
    id: resourceId,
    title: 'Circuit Analysis Report',
    type: 'PDF',
    size: '2.4MB',
    date: '2024-02-01',
    description: 'Comprehensive analysis report documenting voltage stability test results, including data tables, charts, and conclusions.',
    uploadedBy: 'Dr. Smith',
    project: 'Circuit Analysis',
    tags: ['report', 'analysis', 'voltage'],
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>{resource.title}</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Preview */}
        <Card elevation={0}>
          <View style={styles.previewContainer}>
            <View style={[styles.previewIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Ionicons name="document" size={64} color={theme.colors.primary} />
            </View>
            <Text style={[styles.previewType, { color: theme.colors.onSurfaceVariant }]}>
              {resource.type}
            </Text>
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => console.log('Download')}
          >
            <Ionicons name="download" size={20} color="white" />
            <Text style={styles.actionButtonText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => console.log('Share')}
          >
            <Ionicons name="share-outline" size={20} color={theme.colors.onSurface} />
            <Text style={[styles.actionButtonText, { color: theme.colors.onSurface }]}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Details */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Details
          </Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Type:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{resource.type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Size:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{resource.size}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Date:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{resource.date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Uploaded by:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>{resource.uploadedBy}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Project:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.primary }]}>{resource.project}</Text>
          </View>
        </Card>

        {/* Description */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Description
          </Text>
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            {resource.description}
          </Text>
        </Card>

        {/* Tags */}
        <Card elevation={0}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Tags
          </Text>
          <View style={styles.tagsContainer}>
            {resource.tags.map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: `${theme.colors.primary}20` }]}
              >
                <Text style={[styles.tagText, { color: theme.colors.primary }]}>
                  #{tag}
                </Text>
              </View>
            ))}
          </View>
        </Card>

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
  title: {
    flex: 1,
    marginLeft: 8,
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
  previewContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  previewIcon: {
    width: 120,
    height: 120,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewType: {
    fontSize: 16,
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
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
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    height: 20,
  },
});
