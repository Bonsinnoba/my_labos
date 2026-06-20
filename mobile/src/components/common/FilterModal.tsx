import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useTheme, Button, Checkbox, SegmentedButtons, Dialog, Portal, TextInput as PaperTextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SearchFilters, searchService, SavedFilter } from '../../services/searchService';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
  availableFilters?: {
    types?: ('project' | 'experiment' | 'finding' | 'resource' | 'note')[];
    statuses?: string[];
    tags?: string[];
  };
}

export default function FilterModal({
  visible,
  onClose,
  onApplyFilters,
  initialFilters,
  availableFilters,
}: FilterModalProps) {
  const theme = useTheme();
  
  const [filters, setFilters] = useState<SearchFilters>(initialFilters || {});
  const [startDateText, setStartDateText] = useState('');
  const [endDateText, setEndDateText] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  const defaultTypes: ('project' | 'experiment' | 'finding' | 'resource' | 'note')[] = [
    'project',
    'experiment',
    'finding',
    'resource',
    'note',
  ];

  const defaultStatuses = ['PENDING', 'PASS', 'FAIL', 'IN_PROGRESS', 'COMPLETED'];

  const types = availableFilters?.types || defaultTypes;
  const statuses = availableFilters?.statuses || defaultStatuses;
  const availableTags = availableFilters?.tags || [];

  useEffect(() => {
    if (visible) {
      setFilters(initialFilters || {});
      setSavedFilters(searchService.getSavedFilters());
      
      // Set date text from existing filters
      if (initialFilters?.dateRange) {
        setStartDateText(formatDate(initialFilters.dateRange.start));
        setEndDateText(formatDate(initialFilters.dateRange.end));
      } else {
        setStartDateText('');
        setEndDateText('');
      }
    }
  }, [visible, initialFilters]);

  const toggleType = (type: 'project' | 'experiment' | 'finding' | 'resource' | 'note') => {
    const currentTypes = filters.types || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    setFilters({ ...filters, types: newTypes.length > 0 ? newTypes : undefined });
  };

  const toggleStatus = (status: string) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    setFilters({ ...filters, status: newStatuses.length > 0 ? newStatuses : undefined });
  };

  const toggleTag = (tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    setFilters({ ...filters, tags: newTags.length > 0 ? newTags : undefined });
  };

  const addCustomTag = () => {
    if (customTag.trim()) {
      const currentTags = filters.tags || [];
      if (!currentTags.includes(customTag.trim())) {
        setFilters({ ...filters, tags: [...currentTags, customTag.trim()] });
      }
      setCustomTag('');
    }
  };

  const handleDateChange = (text: string, field: 'start' | 'end') => {
    if (field === 'start') {
      setStartDateText(text);
      const parsedDate = parseDate(text);
      if (parsedDate) {
        const dateRange = filters.dateRange || { start: new Date(0), end: new Date() };
        setFilters({
          ...filters,
          dateRange: { ...dateRange, start: parsedDate },
        });
      }
    } else {
      setEndDateText(text);
      const parsedDate = parseDate(text);
      if (parsedDate) {
        const dateRange = filters.dateRange || { start: new Date(0), end: new Date() };
        setFilters({
          ...filters,
          dateRange: { ...dateRange, end: parsedDate },
        });
      }
    }
  };

  const clearDateRange = () => {
    setFilters({ ...filters, dateRange: undefined });
    setStartDateText('');
    setEndDateText('');
  };

  const parseDate = (text: string): Date | null => {
    if (!text) return null;
    const parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleClearAll = () => {
    setFilters({});
  };

  const handleSaveFilter = () => {
    if (filterName.trim()) {
      searchService.saveFilter(filterName.trim(), filters);
      setSavedFilters(searchService.getSavedFilters());
      setFilterName('');
      setShowSaveDialog(false);
    }
  };

  const handleLoadSavedFilter = (savedFilter: SavedFilter) => {
    setFilters(savedFilter.filters);
  };

  const handleDeleteSavedFilter = async (id: string) => {
    await searchService.deleteSavedFilter(id);
    setSavedFilters(searchService.getSavedFilters());
  };

  const hasActiveFilters = () => {
    return (
      (filters.types && filters.types.length > 0) ||
      (filters.status && filters.status.length > 0) ||
      (filters.tags && filters.tags.length > 0) ||
      filters.dateRange !== undefined ||
      filters.sortBy !== undefined ||
      filters.sortOrder !== undefined
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              Advanced Filters
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Saved Filters */}
            {savedFilters.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                    Saved Filters
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowSaveDialog(true)}
                    style={[styles.saveButton, { backgroundColor: theme.colors.primaryContainer }]}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.primary} />
                    <Text style={[styles.saveButtonText, { color: theme.colors.primary }]}>
                      Save Current
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.savedFiltersContainer}>
                  {savedFilters.map((savedFilter) => (
                    <TouchableOpacity
                      key={savedFilter.id}
                      style={[styles.savedFilterChip, { backgroundColor: theme.colors.surfaceVariant }]}
                      onPress={() => handleLoadSavedFilter(savedFilter)}
                      onLongPress={() => handleDeleteSavedFilter(savedFilter.id)}
                    >
                      <Text style={[styles.savedFilterName, { color: theme.colors.onSurface }]}>
                        {savedFilter.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteSavedFilter(savedFilter.id)}
                        style={styles.deleteSavedFilterButton}
                      >
                        <Ionicons name="close" size={14} color={theme.colors.error} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Type Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Type
              </Text>
              <View style={styles.chipContainer}>
                {types.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: filters.types?.includes(type)
                          ? theme.colors.primary
                          : theme.colors.surfaceVariant,
                      },
                    ]}
                    onPress={() => toggleType(type)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: filters.types?.includes(type)
                            ? 'white'
                            : theme.colors.onSurface,
                        },
                      ]}
                    >
                      {capitalizeFirst(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Status Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Status
              </Text>
              <View style={styles.chipContainer}>
                {statuses.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: filters.status?.includes(status)
                          ? theme.colors.primary
                          : theme.colors.surfaceVariant,
                      },
                    ]}
                    onPress={() => toggleStatus(status)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: filters.status?.includes(status)
                            ? 'white'
                            : theme.colors.onSurface,
                        },
                      ]}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Range Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Date Range
              </Text>
              <View style={styles.dateInputContainer}>
                <PaperTextInput
                  mode="outlined"
                  label="Start Date"
                  placeholder="YYYY-MM-DD"
                  value={startDateText}
                  onChangeText={(text) => handleDateChange(text, 'start')}
                  style={styles.dateInput}
                  left={<PaperTextInput.Icon icon="calendar" />}
                />
                <PaperTextInput
                  mode="outlined"
                  label="End Date"
                  placeholder="YYYY-MM-DD"
                  value={endDateText}
                  onChangeText={(text) => handleDateChange(text, 'end')}
                  style={styles.dateInput}
                  left={<PaperTextInput.Icon icon="calendar" />}
                />
                {(startDateText || endDateText) && (
                  <TouchableOpacity
                    style={[styles.clearDateButton, { backgroundColor: theme.colors.error }]}
                    onPress={clearDateRange}
                  >
                    <Ionicons name="close" size={16} color="white" />
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Tags Filter */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Tags
              </Text>
              
              {/* Custom Tag Input */}
              <View style={[styles.tagInputContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                <TextInput
                  style={[styles.tagInput, { color: theme.colors.onSurface }]}
                  placeholder="Add custom tag..."
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  value={customTag}
                  onChangeText={setCustomTag}
                  onSubmitEditing={addCustomTag}
                />
                <TouchableOpacity onPress={addCustomTag}>
                  <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Available Tags */}
              {availableTags.length > 0 && (
                <View style={styles.chipContainer}>
                  {availableTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: filters.tags?.includes(tag)
                            ? theme.colors.primary
                            : theme.colors.surfaceVariant,
                        },
                      ]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: filters.tags?.includes(tag)
                              ? 'white'
                              : theme.colors.onSurface,
                          },
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Selected Tags */}
              {filters.tags && filters.tags.length > 0 && (
                <View style={styles.chipContainer}>
                  {filters.tags
                    .filter(tag => !availableTags.includes(tag))
                    .map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: theme.colors.primary,
                          },
                        ]}
                        onPress={() => toggleTag(tag)}
                      >
                        <Text style={[styles.chipText, { color: 'white' }]}>
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </View>

            {/* Sort Options */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Sort By
              </Text>
              <SegmentedButtons
                value={filters.sortBy || 'relevance'}
                onValueChange={(value) =>
                  setFilters({ ...filters, sortBy: value as 'relevance' | 'date' | 'title' })
                }
                buttons={[
                  { value: 'relevance', label: 'Relevance' },
                  { value: 'date', label: 'Date' },
                  { value: 'title', label: 'Title' },
                ]}
                style={styles.segmentedButtons}
              />

              <Text style={[styles.sectionTitle, { color: theme.colors.primary, marginTop: 16 }]}>
                Sort Order
              </Text>
              <SegmentedButtons
                value={filters.sortOrder || 'desc'}
                onValueChange={(value) =>
                  setFilters({ ...filters, sortOrder: value as 'asc' | 'desc' })
                }
                buttons={[
                  { value: 'desc', label: 'Descending' },
                  { value: 'asc', label: 'Ascending' },
                ]}
                style={styles.segmentedButtons}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.colors.outline }]}>
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={handleClearAll}
              disabled={!hasActiveFilters()}
            >
              <Text
                style={[
                  styles.clearButtonText,
                  {
                    color: hasActiveFilters()
                      ? theme.colors.error
                      : theme.colors.onSurfaceDisabled,
                  },
                ]}
              >
                Clear All
              </Text>
            </TouchableOpacity>
            <Button
              mode="contained"
              onPress={handleApply}
              style={styles.applyButton}
              contentStyle={styles.applyButtonContent}
            >
              Apply Filters
            </Button>
          </View>

          {/* Save Filter Dialog */}
          <Portal>
            <Dialog
              visible={showSaveDialog}
              onDismiss={() => setShowSaveDialog(false)}
              style={styles.dialog}
            >
              <Dialog.Title>Save Filter</Dialog.Title>
              <Dialog.Content>
                <PaperTextInput
                  mode="outlined"
                  label="Filter Name"
                  value={filterName}
                  onChangeText={setFilterName}
                  placeholder="My custom filter"
                  autoFocus
                />
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setShowSaveDialog(false)}>Cancel</Button>
                <Button onPress={handleSaveFilter} mode="contained">Save</Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>
        </View>
      </View>
    </Modal>
  );
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  savedFiltersContainer: {
    marginBottom: 8,
  },
  savedFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  savedFilterName: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  deleteSavedFilterButton: {
    padding: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateInputContainer: {
    gap: 12,
  },
  dateInput: {
    marginBottom: 8,
  },
  clearDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  clearDateText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    fontSize: 14,
  },
  segmentedButtons: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
  },
  applyButtonContent: {
    paddingVertical: 4,
  },
  dialog: {
    borderRadius: 16,
  },
});
