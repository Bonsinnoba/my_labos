import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, SafeAreaView, Modal } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { notebookApi, NotebookEntry } from '../../services/api/services';
import { projectsApi, Project } from '../../services/api/projects';
import { experimentsApi, Experiment } from '../../services/api/experiments';
import { createNoteWithQueue, updateNoteWithQueue, deleteNoteWithQueue, mergeQueueIntoEntries } from '../../services/offlineQueue';

interface NotebookFormData {
  title: string;
  content: string;
  entry_type: 'text' | 'voice' | 'mixed';
  project_id?: number | string;
  experiment_id?: number | string;
  tags: string;
  voice_transcription?: string;
}

export default function NotebookScreen({ navigation }: any) {
  const theme = useTheme();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<NotebookEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [formData, setFormData] = useState<NotebookFormData>({
    title: '',
    content: '',
    entry_type: 'text',
    tags: '',
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showExperimentPicker, setShowExperimentPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const loadEntries = async () => {
    try {
      console.log('[Notebook] loading entries');
      const notebookEntries = await notebookApi.getAll();
      console.log('[Notebook] loaded entries', notebookEntries);
      const normalizedEntries = notebookEntries.map((entry) => {
        const tags = Array.isArray(entry.tags)
          ? entry.tags
          : typeof entry.tags === 'string' && entry.tags.length > 0
            ? entry.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
            : [];

        return {
          ...entry,
          tags,
        };
      });
      const mergedEntries = await mergeQueueIntoEntries(normalizedEntries);
      setEntries(mergedEntries);
    } catch (error: any) {
      console.error('Error loading entries:', error, error?.response?.data ?? error?.message ?? error);
      Alert.alert('Error', `Unable to load notebook entries: ${error?.message || 'Unknown error'}`);
    }
  };

  const loadProjectsAndExperiments = async () => {
    try {
      const [projectsData, experimentsData] = await Promise.all([
        projectsApi.getAll(),
        experimentsApi.getAll(),
      ]);
      setProjects(projectsData);
      setExperiments(experimentsData);
    } catch (error) {
      console.error('Error loading projects and experiments:', error);
    }
  };

  const startRecording = async () => {
    try {
      Alert.alert('Voice Recording', 'Voice recording is a desktop-style tool in the roadmap.');
      setIsRecording(true);
      setIsSpeaking(false);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setFormData({ ...formData, voice_transcription: 'Transcription placeholder created from desktop-style note input.' });
      Alert.alert('Recording Saved', 'Voice recording placeholder saved.');
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const speakText = async (text: string) => {
    try {
      Alert.alert('Read Aloud', 'Text-to-speech is enabled from the editor toolbar.');
      setIsSpeaking(true);
    } catch (error) {
      console.error('Error speaking text:', error);
      Alert.alert('Error', 'Failed to read text aloud');
    }
  };

  const saveCurrentEntry = async () => {
    try {
      const payload = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map((tag) => tag.trim()) : [],
      };

      let result;
      if (selectedEntry) {
        result = await updateNoteWithQueue(selectedEntry.id, payload);
      } else {
        result = await createNoteWithQueue(payload);
      }

      if (result?.queued) {
        if (selectedEntry) {
          setEntries((prevEntries) => prevEntries.map((entry) =>
            String(entry.id) === String(selectedEntry.id)
              ? { ...entry, ...payload, updated_at: new Date().toISOString(), pendingSync: true }
              : entry
          ));
        } else if (result.data) {
          setEntries((prevEntries) => [
            { ...(result.data as NotebookEntry), pendingSync: true },
            ...prevEntries,
          ]);
        }
      } else {
        loadEntries();
      }

      setFormData({ title: '', content: '', entry_type: 'text', tags: '' });
      setSelectedEntry(null);
      setIsEditing(false);

      if (result?.queued) {
        Alert.alert('Saved Offline', 'This notebook entry has been queued and will sync when internet is available.');
      }
    } catch (error) {
      console.error('[Notebook] save entry failed:', error);
      Alert.alert('Error', 'Failed to save entry');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await deleteNoteWithQueue(id);
      if (result?.queued) {
        setEntries((prevEntries) => prevEntries.filter((entry) => String(entry.id) !== String(id)));
      } else {
        loadEntries();
      }
      setIsEditing(false);
      setSelectedEntry(null);

      if (result?.queued) {
        Alert.alert('Deleted Offline', 'This notebook delete has been queued and will sync when internet is available.');
      }
    } catch (error) {
      console.error('[Notebook] delete entry failed:', error);
      Alert.alert('Error', 'Failed to delete entry');
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      loadEntries();
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = entries.filter((entry) =>
      entry.title.toLowerCase().includes(query) ||
      entry.content.toLowerCase().includes(query) ||
      (entry.tags && entry.tags.some((tag) => tag.toLowerCase().includes(query)))
    );
    setEntries(filtered);
  };

  const handleDateFilter = () => {
    if (!dateFilter.start || !dateFilter.end) {
      loadEntries();
      return;
    }

    const filtered = entries.filter((entry) => {
      const entryDate = new Date(entry.created_at).toISOString().split('T')[0];
      return entryDate >= dateFilter.start && entryDate <= dateFilter.end;
    });
    setEntries(filtered);
  };

  const getNotebookStats = () => {
    const totalEntries = entries.length;
    const typeCounts = entries.reduce((acc, entry) => {
      acc[entry.entry_type] = (acc[entry.entry_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const allTags = entries.flatMap((entry) => entry.tags || []);
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEntries,
      byType: typeCounts,
      topTags: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };
  };

  const renderEntryItem = ({ item }: { item: NotebookEntry }) => (
    <TouchableOpacity
      style={[styles.entryCard, { backgroundColor: theme.colors.background }]}
      onPress={() => {
        setSelectedEntry(item);
        setFormData({
          title: item.title,
          content: item.content,
          entry_type: item.entry_type as 'text' | 'voice' | 'mixed',
          tags: item.tags?.join(', ') || '',
          project_id: item.project_id,
          experiment_id: item.experiment_id,
          voice_transcription: item.voice_transcription,
        });
        setIsEditing(true);
      }}
    >
      <View style={styles.entryHeader}>
        <Text style={[styles.entryTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={[styles.entryTypeBadge, { backgroundColor: theme.colors.primaryContainer }]}> 
          <Text style={[styles.entryType, { color: theme.colors.primary }]}> {item.entry_type.toUpperCase()} </Text>
        </View>
      </View>
      <Text style={[styles.entryPreview, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
        {item.content}
      </Text>
      <View style={styles.entryMetaRow}>
        {item.pendingSync && (
          <View style={[styles.syncBadge, { borderColor: theme.colors.primaryContainer, backgroundColor: theme.colors.primaryContainer }]}> 
            <Text style={[styles.syncBadgeText, { color: theme.colors.primary }]}>{'Pending Sync'}</Text>
          </View>
        )}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 3).map((tag, index) => (
              <Text key={index} style={[styles.tag, { color: theme.colors.primary }]}>#{tag}</Text>
            ))}
            {item.tags.length > 3 && (
              <Text style={[styles.tag, { color: theme.colors.primary }]}>+{item.tags.length - 3}</Text>
            )}
          </View>
        )}
        <Text style={[styles.entryDate, { color: theme.colors.outline }]}> {new Date(item.created_at).toLocaleDateString()} </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEditor = () => (
    <ScrollView style={styles.editor} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={[styles.editorShell, { backgroundColor: theme.colors.surface }]}> 
        <View style={styles.editorHeader}>
          <View style={styles.editorHeaderLeft}>
            <TouchableOpacity onPress={handleCloseEditor} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color={theme.colors.primary} />
              <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>Back</Text>
            </TouchableOpacity>
            <Text style={[styles.editorTitle, { color: theme.colors.onSurface }]}>Notebook Editor</Text>
          </View>
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: theme.colors.primary }]} onPress={saveCurrentEntry}>
            <Ionicons name="save" size={18} color="white" />
            <Text style={styles.primaryActionText}>Save</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.titleInput, { backgroundColor: theme.colors.background, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
          value={formData.title}
          onChangeText={(text) => setFormData({ ...formData, title: text })}
          placeholder="Note title..."
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />

        <View style={styles.editorToolbar}>
          <TouchableOpacity style={[styles.toolbarButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.outline }]} onPress={() => setFormData({ ...formData, entry_type: 'text' })}>
            <Ionicons name="document-text" size={18} color={theme.colors.onSurface} />
            <Text style={[styles.toolbarButtonText, { color: theme.colors.onSurface }]}>Text</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolbarButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.outline }]} onPress={() => setFormData({ ...formData, entry_type: 'voice' })}>
            <Ionicons name="mic" size={18} color={theme.colors.onSurface} />
            <Text style={[styles.toolbarButtonText, { color: theme.colors.onSurface }]}>Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolbarButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.outline }]} onPress={() => setFormData({ ...formData, entry_type: 'mixed' })}>
            <Ionicons name="layers" size={18} color={theme.colors.onSurface} />
            <Text style={[styles.toolbarButtonText, { color: theme.colors.onSurface }]}>Mixed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolbarButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.outline }]} onPress={isRecording ? stopRecording : startRecording}>
            <Ionicons name={isRecording ? 'stop-circle' : 'mic-circle'} size={18} color={theme.colors.onSurface} />
            <Text style={[styles.toolbarButtonText, { color: theme.colors.onSurface }]}>{isRecording ? 'Stop' : 'Record'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolbarButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.outline }]} onPress={() => speakText(formData.voice_transcription || formData.content)}>
            <Ionicons name="volume-high" size={18} color={theme.colors.onSurface} />
            <Text style={[styles.toolbarButtonText, { color: theme.colors.onSurface }]}>Read</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.textArea, { backgroundColor: theme.colors.background, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
          value={formData.content}
          onChangeText={(text) => setFormData({ ...formData, content: text })}
          placeholder="Start writing your note..."
          placeholderTextColor={theme.colors.onSurfaceVariant}
          multiline
          numberOfLines={15}
          textAlignVertical="top"
        />

        <View style={styles.metaRow}>
          <View style={styles.metaColumn}>
            <Text style={[styles.metaLabel, { color: theme.colors.onSurface }]}>Project</Text>
            <Text style={[styles.metaValue, { color: theme.colors.onSurfaceVariant }]}> {formData.project_id ? projects.find((p) => String(p.id) === String(formData.project_id))?.name : 'None'} </Text>
          </View>
          <View style={styles.metaColumn}>
            <Text style={[styles.metaLabel, { color: theme.colors.onSurface }]}>Experiment</Text>
            <Text style={[styles.metaValue, { color: theme.colors.onSurfaceVariant }]}> {formData.experiment_id ? experiments.find((e) => String(e.id) === String(formData.experiment_id))?.log_title || 'None' : 'None'} </Text>
          </View>
        </View>

        <View style={[styles.inputGroup, { marginBottom: 12 }]}> 
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Tags</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
            value={formData.tags}
            onChangeText={(text) => setFormData({ ...formData, tags: text })}
            placeholder="tag1, tag2, tag3"
            placeholderTextColor={theme.colors.onSurfaceVariant}
          />
        </View>

        <View style={styles.editorFooter}> 
          <TouchableOpacity style={[styles.deleteAction, { backgroundColor: theme.colors.error }]} onPress={() => {
            if (!selectedEntry) return;
            Alert.alert('Delete Entry', 'Confirm delete this notebook note?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => handleDelete(selectedEntry.id) },
            ]);
          }}>
            <Ionicons name="trash" size={18} color="white" />
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
          <View style={styles.chipRow}>
            {formData.tags.split(',').filter(Boolean).map((tag) => (
              <View key={tag.trim()} style={[styles.chip, { borderColor: theme.colors.primaryContainer }]}> 
                <Text style={[styles.chipText, { color: theme.colors.primary }]}>#{tag.trim()}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const handleCloseEditor = () => {
    setFormData({ title: '', content: '', entry_type: 'text', tags: '' });
    setSelectedEntry(null);
    setIsEditing(false);
  };

  useEffect(() => {
    loadEntries();
    loadProjectsAndExperiments();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [searchQuery]);

  const stats = getNotebookStats();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}> 
        <View style={styles.headerTitle}> 
          <Ionicons name="book" size={28} color={theme.colors.primary} style={styles.headerIcon} />
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>Notebook</Text>
        </View>
        <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.colors.primary }]} onPress={() => setIsEditing(true)}>
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={[styles.sidebar, { backgroundColor: theme.colors.surface }]}> 
          <View style={styles.sidebarHeader}> 
            <Text style={[styles.sidebarTitle, { color: theme.colors.onSurface }]}>Notes</Text>
            <Text style={[styles.sidebarCount, { color: theme.colors.primary }]}> {entries.length} entries </Text>
          </View>

          <View style={[styles.searchBar, { backgroundColor: theme.colors.background, borderColor: theme.colors.outline }]}> 
            <Ionicons name="search" size={18} color={theme.colors.onSurfaceVariant} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.onSurface }]}
              placeholder="Search notes..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); loadEntries(); }}>
                <Ionicons name="close-circle" size={18} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.statsPanel, { backgroundColor: theme.colors.background, borderColor: theme.colors.outline }]}> 
            <Text style={[styles.statsTitle, { color: theme.colors.onSurface }]}>Notebook Summary</Text>
            <View style={styles.statsRow}> 
              <Text style={[styles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>Entries</Text>
              <Text style={[styles.statsValue, { color: theme.colors.onSurface }]}>{stats.totalEntries}</Text>
            </View>
            <View style={styles.statsRow}> 
              <Text style={[styles.statsLabel, { color: theme.colors.onSurfaceVariant }]}>Text / Voice / Mixed</Text>
              <Text style={[styles.statsValue, { color: theme.colors.onSurface }]}> {stats.byType.text || 0} / {stats.byType.voice || 0} / {stats.byType.mixed || 0} </Text>
            </View>
            <View style={styles.tagPreviewRow}> 
              {stats.topTags.map(([tag, count]) => (
                <View key={tag} style={[styles.tagPreview, { borderColor: theme.colors.primaryContainer }]}> 
                  <Text style={[styles.tagPreviewText, { color: theme.colors.primary }]}>#{tag} � {count}</Text>
                </View>
              ))}
            </View>
          </View>

          <FlatList
            data={entries}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderEntryItem}
            contentContainerStyle={styles.entriesList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No notebook entries found. Tap New Entry to create one.</Text>
              </View>
            }
          />
        </View>

        {isEditing ? renderEditor() : (
          <View style={[styles.previewPane, { backgroundColor: theme.colors.surface }]}> 
            <Text style={[styles.previewHeading, { color: theme.colors.onSurface }]}>Select a note to edit or create a new entry.</Text>
            <Text style={[styles.previewDescription, { color: theme.colors.onSurfaceVariant }]}>This workspace mirrors the desktop engineering notebook with a rich editor, toolbar actions, and quick metadata panels.</Text>
          </View>
        )}
      </View>

      <Modal visible={showProjectPicker} transparent animationType="slide" onRequestClose={() => setShowProjectPicker(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}> 
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}> 
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>Select Project</Text>
            <ScrollView style={styles.pickerList}> 
              <TouchableOpacity style={styles.pickerItem} onPress={() => { setFormData({ ...formData, project_id: undefined }); setShowProjectPicker(false); }}>
                <Text style={[styles.pickerItemText, { color: theme.colors.onSurface }]}>No Project</Text>
              </TouchableOpacity>
              {projects.map((project) => (
                <TouchableOpacity key={project.id} style={[styles.pickerItem, String(formData.project_id) === String(project.id) && { backgroundColor: theme.colors.primaryContainer }]} onPress={() => { setFormData({ ...formData, project_id: project.id }); setShowProjectPicker(false); }}>
                  <Text style={[styles.pickerItemText, String(formData.project_id) === String(project.id) ? { color: theme.colors.primary } : { color: theme.colors.onSurface }]}>{project.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: theme.colors.surfaceVariant }]} onPress={() => setShowProjectPicker(false)}>
              <Text style={[styles.modalButtonText, { color: theme.colors.onSurface }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showExperimentPicker} transparent animationType="slide" onRequestClose={() => setShowExperimentPicker(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}> 
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}> 
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>Select Experiment</Text>
            <ScrollView style={styles.pickerList}> 
              <TouchableOpacity style={styles.pickerItem} onPress={() => { setFormData({ ...formData, experiment_id: undefined }); setShowExperimentPicker(false); }}>
                <Text style={[styles.pickerItemText, { color: theme.colors.onSurface }]}>No Experiment</Text>
              </TouchableOpacity>
              {experiments.map((experiment) => (
                <TouchableOpacity key={experiment.id} style={[styles.pickerItem, String(formData.experiment_id) === String(experiment.id) && { backgroundColor: theme.colors.primaryContainer }]} onPress={() => { setFormData({ ...formData, experiment_id: experiment.id }); setShowExperimentPicker(false); }}>
                  <Text style={[styles.pickerItemText, String(formData.experiment_id) === String(experiment.id) ? { color: theme.colors.primary } : { color: theme.colors.onSurface }]}>{experiment.log_title || experiment.id}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: theme.colors.surfaceVariant }]} onPress={() => setShowExperimentPicker(false)}>
              <Text style={[styles.modalButtonText, { color: theme.colors.onSurface }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#00000010',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    marginRight: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  body: {
    flex: 1,
    flexDirection: 'column',
  },
  sidebar: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sidebarCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  statsPanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statsLabel: {
    fontSize: 13,
  },
  statsValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  tagPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPreview: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagPreviewText: {
    fontSize: 12,
    fontWeight: '600',
  },
  entriesList: {
    paddingBottom: 8,
  },
  entryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#00000010',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  entryTypeBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  entryType: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  entryPreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  entryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  syncBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  entryDate: {
    fontSize: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
  },
  previewPane: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    minHeight: 220,
    justifyContent: 'center',
  },
  previewHeading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  previewDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  editor: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  editorShell: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#00000010',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editorHeaderLeft: {
    flex: 1,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryActionText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  titleInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  editorToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  textArea: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 220,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  metaColumn: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  editorFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  deleteActionText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    flex: 1,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  pickerList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  pickerItem: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  pickerItemText: {
    fontSize: 15,
  },
  modalButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
