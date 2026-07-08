import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, RefreshControl, Alert, Linking, Platform, Image } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import AdvancedSearchBar from '../../components/common/AdvancedSearchBar';
import ResourceCard from '../../components/lists/ResourceCard';
import { resourcesApi, Resource } from '../../services/api/resources';
import { CryptoUtils } from '../../services/crypto/cryptoUtils';
import { useSettingsStore } from '../../store/settingsStore';
import { downloadFileWithCache } from '../../services/api';

export default function ResourcesScreen({ navigation }: any) {
  const theme = useTheme();
  const { encryptionKey } = useSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await resourcesApi.getAll();
      setResources(data);
    } catch (err) {
      setError('Failed to load resources');
      console.error('Error loading resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setError(null);
      const data = await resourcesApi.getAll();
      setResources(data);
    } catch (err) {
      setError('Failed to load resources');
      console.error('Error loading resources:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const typeFilters = ['All', 'PDF', 'CSV', 'IMAGE', 'VIDEO', 'OTHER'];

  const filteredResources = resources.filter(resource => {
    const matchesSearch = (resource.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'All' || resource.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PDF': return theme.colors.error;
      case 'CSV': return theme.colors.success;
      case 'IMAGE': return theme.colors.info;
      case 'VIDEO': return theme.colors.warning;
      case 'OTHER': return theme.colors.primary;
      default: return theme.colors.primary;
    }
  };

  const isFileTypeSupported = (type: string): boolean => {
    const supportedTypes = ['PDF', 'IMAGE', 'VIDEO', 'CSV'];
    return supportedTypes.includes(type);
  };

  const handleOpenResource = async (resource: Resource) => {
    try {
      if (!resource.cloud_file_url && !resource.file_path) {
        Alert.alert('Error', 'No file URL available for this resource');
        return;
      }

      // Check if file type is supported on mobile
      if (!isFileTypeSupported(resource.type)) {
        Alert.alert(
          'Unsupported File Type',
          `This file type (${resource.type}) cannot be opened on mobile. Please use a desktop computer.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Extract filename from URL or path
      const fileUrl = resource.cloud_file_url || resource.file_path;
      const filename = fileUrl.split('/').pop() || 'downloaded_file';

      // Show loading indicator
      Alert.alert('Downloading', 'Downloading file to device...', [
        { text: 'OK', onPress: () => {} }
      ]);

      try {
        // Download file to mobile cache (72-hour expiry)
        const localPath = await downloadFileWithCache(filename, resource.size ? parseInt(resource.size) : undefined);
        
        if (localPath) {
          // Open the file from local cache
          const supported = await Linking.canOpenURL(`file://${localPath}`);
          if (supported) {
            await Linking.openURL(`file://${localPath}`);
          } else {
            Alert.alert('Error', 'Cannot open this file');
          }
        } else {
          throw new Error('Download failed');
        }
      } catch (downloadError) {
        console.error('Download failed, falling back to direct URL:', downloadError);
        
        // Fallback to opening the original URL if download fails
        const supported = await Linking.canOpenURL(fileUrl);
        if (supported) {
          await Linking.openURL(fileUrl);
        } else {
          Alert.alert('Error', 'Cannot open this file URL');
        }
      }
    } catch (error) {
      console.error('Error opening resource:', error);
      Alert.alert('Error', 'Failed to open resource');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Resources
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            <Ionicons
              name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
              size={24}
              color={theme.colors.onSurface}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => console.log('Add new resource')}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Search */}
        <AdvancedSearchBar
          placeholder="Search resources..."
          onSearch={setSearchQuery}
          showFilters={false}
          debounceMs={300}
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
                  backgroundColor: filterType === type ? getTypeColor(type) : theme.colors.surface,
                  borderColor: filterType === type ? getTypeColor(type) : theme.colors.border,
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
        <View style={styles.list}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
                Loading resources...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
              <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
                onPress={loadResources}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredResources.length > 0 ? (
            viewMode === 'list' ? (
              filteredResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  title={resource.title || 'Untitled Resource'}
                  type={resource.type || 'OTHER'}
                  size={resource.size}
                  date={resource.date || (resource.created_at ? new Date(resource.created_at).toLocaleDateString() : 'Unknown')}
                  thumbnailUrl={resource.thumbnail_url}
                  onPress={() => handleOpenResource(resource)}
                />
              ))
            ) : (
              <View style={styles.gridContainer}>
                {filteredResources.map((resource) => (
                  <TouchableOpacity
                    key={resource.id}
                    style={[styles.gridItem, { backgroundColor: theme.colors.surface }]}
                    onPress={() => handleOpenResource(resource)}
                  >
                    {resource.thumbnail_url ? (
                      <Image
                        source={{ uri: resource.thumbnail_url }}
                        style={styles.gridThumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.gridIcon, { backgroundColor: `${getTypeColor(resource.type || 'OTHER')}20` }]}>
                        <Ionicons
                          name={
                            resource.type === 'PDF' ? 'document-text' :
                            resource.type === 'IMAGE' ? 'image' :
                            resource.type === 'VIDEO' ? 'videocam' :
                            resource.type === 'CSV' ? 'grid' : 'document'
                          } as any
                          size={32}
                          color={getTypeColor(resource.type || 'OTHER')}
                        />
                      </View>
                    )}
                    <Text style={[styles.gridTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                      {resource.title || 'Untitled Resource'}
                    </Text>
                    <Text style={[styles.gridType, { color: theme.colors.onSurfaceVariant }]}>
                      {resource.type || 'OTHER'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={64} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                No resources found
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
                Try adjusting your search or filters
              </Text>
            </View>
          )}
        </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  gridItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridThumbnail: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  gridType: {
    fontSize: 10,
    textAlign: 'center',
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
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
