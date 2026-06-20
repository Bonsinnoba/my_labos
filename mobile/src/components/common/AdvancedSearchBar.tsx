import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, FlatList } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { searchService, SearchFilters } from '../../services/searchService';
import FilterModal from './FilterModal';

interface AdvancedSearchBarProps {
  onSearch: (query: string, filters?: SearchFilters) => void;
  onFilterPress?: () => void;
  placeholder?: string;
  showFilters?: boolean;
  debounceMs?: number;
  availableFilters?: {
    types?: ('project' | 'experiment' | 'finding' | 'resource' | 'note')[];
    statuses?: string[];
    tags?: string[];
  };
}

export default function AdvancedSearchBar({
  onSearch,
  onFilterPress,
  placeholder = 'Search projects, experiments, findings...',
  showFilters = true,
  debounceMs = 300,
  availableFilters,
}: AdvancedSearchBarProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({});
  const [filterCount, setFilterCount] = useState(0);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Trigger search when debounced query changes
  useEffect(() => {
    onSearch(debouncedQuery, activeFilters);
  }, [debouncedQuery, activeFilters, onSearch]);

  useEffect(() => {
    calculateFilterCount();
  }, [activeFilters]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    
    if (text.length > 0) {
      const newSuggestions = searchService.getSuggestions(text);
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSearch = () => {
    if (query.trim()) {
      searchService.addToHistory(query, 0);
      onSearch(query, activeFilters);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    searchService.addToHistory(suggestion, 0);
    onSearch(suggestion, activeFilters);
  };

  const handleClear = () => {
    setQuery('');
    setShowSuggestions(false);
    onSearch('', activeFilters);
  };

  const handleFilterPress = () => {
    setShowFilterModal(true);
  };

  const handleApplyFilters = (filters: SearchFilters) => {
    setActiveFilters(filters);
    onSearch(query, filters);
  };

  const calculateFilterCount = () => {
    let count = 0;
    if (activeFilters.types?.length) count++;
    if (activeFilters.dateRange) count++;
    if (activeFilters.tags?.length) count++;
    if (activeFilters.status?.length) count++;
    setFilterCount(count);
  };

  const renderSuggestion = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.suggestionItem, { borderBottomColor: theme.colors.outline }]}
      onPress={() => handleSuggestionPress(item)}
    >
      <Ionicons name="search" size={16} color={theme.colors.onSurfaceVariant} />
      <Text style={[styles.suggestionText, { color: theme.colors.onSurface }]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Ionicons name="search" size={20} color={theme.colors.onSurfaceVariant} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={query}
          onChangeText={handleQueryChange}
          onSubmitEditing={handleSearch}
          onFocus={() => {
            if (query.length > 0) {
              setShowSuggestions(true);
            }
          }}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear}>
            <Ionicons name="close-circle" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
        {showFilters && (
          <TouchableOpacity onPress={handleFilterPress} style={styles.filterButton}>
            <Ionicons name="options" size={20} color={theme.colors.primary} />
            {filterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Active Filters */}
      {filterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.activeFiltersContainer}
        >
          {activeFilters.types?.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, { backgroundColor: theme.colors.primaryContainer }]}
              onPress={() => {
                setActiveFilters({
                  ...activeFilters,
                  types: activeFilters.types?.filter(t => t !== type),
                });
              }}
            >
              <Text style={[styles.filterChipText, { color: theme.colors.primary }]}>
                {type}
              </Text>
              <Ionicons name="close" size={14} color={theme.colors.primary} />
            </TouchableOpacity>
          ))}
          {activeFilters.status?.map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, { backgroundColor: theme.colors.primaryContainer }]}
              onPress={() => {
                setActiveFilters({
                  ...activeFilters,
                  status: activeFilters.status?.filter(s => s !== status),
                });
              }}
            >
              <Text style={[styles.filterChipText, { color: theme.colors.primary }]}>
                {status}
              </Text>
              <Ionicons name="close" size={14} color={theme.colors.primary} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.clearFiltersButton, { backgroundColor: theme.colors.error }]}
            onPress={() => {
              setActiveFilters({});
              onSearch(query, {});
            }}
          >
            <Ionicons name="refresh" size={14} color="white" />
            <Text style={styles.clearFiltersText}>Clear All</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { backgroundColor: theme.colors.surface }]}>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item, index) => `${item}-${index}`}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApplyFilters={handleApplyFilters}
        initialFilters={activeFilters}
        availableFilters={availableFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  filterButton: {
    marginLeft: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  activeFiltersContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    marginRight: 4,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  clearFiltersText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 4,
  },
  suggestionsContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    maxHeight: 200,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  suggestionText: {
    fontSize: 16,
    marginLeft: 12,
  },
});
