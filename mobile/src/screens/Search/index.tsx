import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import AdvancedSearchBar from '../../components/common/AdvancedSearchBar';
import SearchResults from '../../components/common/SearchResults';
import { searchService, SearchResult, SearchIndexItem, SearchFilters } from '../../services/searchService';

export default function SearchScreen({ navigation }: any) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexStats, setIndexStats] = useState(searchService.getIndexStats());

  useEffect(() => {
    // Refresh index stats when screen mounts
    setIndexStats(searchService.getIndexStats());
  }, []);

  const handleSearch = (searchQuery: string, searchFilters?: SearchFilters) => {
    setQuery(searchQuery);
    setFilters(searchFilters || {});
    
    if (searchQuery.trim()) {
      setLoading(true);
      // Simulate async search for better UX
      setTimeout(() => {
        const searchResults = searchService.search(searchQuery, searchFilters);
        setResults(searchResults);
        setLoading(false);
        
        // Add to search history
        searchService.addToHistory(searchQuery, searchResults.length);
      }, 100);
    } else {
      setResults([]);
      setLoading(false);
    }
  };

  const handleResultPress = (item: SearchIndexItem) => {
    // Navigate based on item type
    switch (item.type) {
      case 'project':
        navigation.navigate('ProjectDetail', { projectId: item.id });
        break;
      case 'experiment':
        navigation.navigate('ExperimentDetail', { experimentId: item.id });
        break;
      case 'finding':
        navigation.navigate('FindingDetail', { findingId: item.id });
        break;
      case 'note':
        navigation.navigate('Notebook');
        break;
      default:
        console.log('Unknown item type:', item.type);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>
            Search
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {indexStats.totalItems} items indexed
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <AdvancedSearchBar
        placeholder="Search projects, experiments, findings..."
        onSearch={handleSearch}
        showFilters={true}
        availableFilters={{
          types: ['project', 'experiment', 'finding', 'resource', 'note'],
          statuses: ['PENDING', 'PASS', 'FAIL', 'IN_PROGRESS', 'COMPLETED'],
          tags: ['urgent', 'high-priority', 'low-priority', 'review', 'draft'],
        }}
      />

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <View style={styles.resultsContainer}>
          <SearchResults
            results={results}
            onResultPress={handleResultPress}
            emptyMessage={query ? 'No results found' : 'Start typing to search'}
            showCategories={true}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerContent: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsContainer: {
    flex: 1,
  },
});
