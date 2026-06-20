import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SearchResult, SearchIndexItem } from '../../services/searchService';

interface SearchResultsProps {
  results: SearchResult[];
  onResultPress: (item: SearchIndexItem) => void;
  emptyMessage?: string;
  showCategories?: boolean;
}

export default function SearchResults({
  results,
  onResultPress,
  emptyMessage = 'No results found',
  showCategories = true,
}: SearchResultsProps) {
  const theme = useTheme();

  if (results.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search" size={64} color={theme.colors.onSurfaceVariant} />
        <Text style={[styles.emptyMessage, { color: theme.colors.onSurfaceVariant }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  if (showCategories) {
    const categorizedResults = categorizeResults(results);
    
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {Object.entries(categorizedResults).map(([category, items]) => (
          <View key={category} style={styles.categorySection}>
            <View style={[styles.categoryHeader, { borderBottomColor: theme.colors.outline }]}>
              <Text style={[styles.categoryTitle, { color: theme.colors.primary }]}>
                {getCategoryIcon(category)}
              </Text>
              <Text style={[styles.categoryTitle, { color: theme.colors.primary }]}>
                {category}
              </Text>
              <Text style={[styles.categoryCount, { color: theme.colors.onSurfaceVariant }]}>
                ({items.length})
              </Text>
            </View>
            {items.map((result, index) => (
              <SearchResultItem
                key={result.item.id}
                result={result}
                onPress={() => onResultPress(result.item)}
                showDivider={index < items.length - 1}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={results}
      renderItem={({ item, index }) => (
        <SearchResultItem
          result={item}
          onPress={() => onResultPress(item.item)}
          showDivider={index < results.length - 1}
        />
      )}
      keyExtractor={(item) => item.item.id}
      style={styles.container}
    />
  );
}

function categorizeResults(results: SearchResult[]): Record<string, SearchResult[]> {
  const categories: Record<string, SearchResult[]> = {};
  
  results.forEach(result => {
    const category = capitalizeFirst(result.item.type);
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(result);
  });

  return categories;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getCategoryIcon(type: string): string {
  const icons: Record<string, string> = {
    'Project': 'folder',
    'Experiment': 'flask',
    'Finding': 'document-text',
    'Resource': 'library',
    'Note': 'create',
  };
  return icons[type] || 'document';
}

interface SearchResultItemProps {
  result: SearchResult;
  onPress: () => void;
  showDivider: boolean;
}

function SearchResultItem({ result, onPress, showDivider }: SearchResultItemProps) {
  const theme = useTheme();
  const { item, score, highlights } = result;

  return (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={onPress}
    >
      <View style={styles.resultContent}>
        <View style={styles.resultHeader}>
          <Ionicons
            name={getCategoryIcon(capitalizeFirst(item.type)) as any}
            size={20}
            color={theme.colors.primary}
          />
          <Text style={[styles.resultTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
            {highlightText(item.title, highlights)}
          </Text>
        </View>
        
        {item.description && (
          <Text style={[styles.resultDescription, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
            {highlightText(item.description, highlights)}
          </Text>
        )}
        
        <View style={styles.resultMeta}>
          <Text style={[styles.resultScore, { color: theme.colors.onSurfaceVariant }]}>
            Relevance: {score}
          </Text>
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {item.tags.slice(0, 3).map((tag, index) => (
                <View
                  key={index}
                  style={[styles.tag, { backgroundColor: theme.colors.primaryContainer }]}
                >
                  <Text style={[styles.tagText, { color: theme.colors.primary }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />
      
      {showDivider && <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />}
    </TouchableOpacity>
  );
}

function highlightText(text: string, highlights: SearchResult['highlights']): string {
  let highlightedText = text;
  
  highlights.forEach(highlight => {
    if (highlight.field === 'title' || highlight.field === 'description') {
      // Remove markdown markers for display
      highlightedText = highlightedText.replace(/\*\*(.*?)\*\*/g, '$1');
    }
  });
  
  return highlightedText;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyMessage: {
    fontSize: 16,
    marginTop: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  categoryCount: {
    fontSize: 14,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultContent: {
    flex: 1,
    marginRight: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  resultDescription: {
    fontSize: 14,
    marginLeft: 28,
    marginBottom: 4,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 28,
  },
  resultScore: {
    fontSize: 12,
    marginRight: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 1,
  },
});
