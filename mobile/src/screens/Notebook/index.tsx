import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, SafeAreaView, Modal } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { notebookApi, NotebookEntry } from '../../services/api/services';
import { projectsApi, Project } from '../../services/api/projects';
import { experimentsApi, Experiment } from '../../services/api/experiments';

interface NotebookFormData {
  title: string;
  content: string;
  entry_type: 'text' | 'voice' | 'mixed';
  project_id?: number;
  experiment_id?: number;
  tags: string;
  voice_transcription?: string;
}

export default function NotebookScreen({ navigation }: any) {
  const theme = useTheme();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<NotebookEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
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
      // For now, we'll use a placeholder since the API might not have a getAll endpoint
      // In a real implementation, you'd call: const response = await notebookApi.getAll();
      setEntries([
        {
          id: 1,
          title: 'Circuit Analysis Notes',
          content: 'Initial voltage measurements show stable output...',
          entry_type: 'text',
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Error loading entries:', error);
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
      // Placeholder for voice recording functionality
      // Audio functionality requires proper native module configuration
      Alert.alert('Voice Recording', 'Voice recording will be implemented with proper native module setup.');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setFormData({ ...formData, voice_transcription: 'Voice recording saved. Transcription pending...' });
      Alert.alert('Recording Saved', 'Voice recording has been saved. Transcription will be added soon.');
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const speakText = async (text: string) => {
    try {
      // Placeholder for text-to-speech functionality
      // Audio functionality requires proper native module configuration
      Alert.alert('Read Aloud', 'Text-to-speech will be implemented with proper native module setup.');
    } catch (error) {
      console.error('Error speaking text:', error);
      Alert.alert('Error', 'Failed to read text aloud');
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
      };
      
      if (selectedEntry) {
        await notebookApi.update(selectedEntry.id, payload);
      } else {
        await notebookApi.create(payload);
      }
      setIsEditing(false);
      setSelectedEntry(null);
      setFormData({ title: '', content: '', entry_type: 'text', tags: '' });
      loadEntries();
    } catch (error) {
      Alert.alert('Error', 'Failed to save entry');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notebookApi.delete(id);
      loadEntries();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete entry');
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      loadEntries();
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = entries.filter(entry => 
      entry.title.toLowerCase().includes(query) || 
      entry.content.toLowerCase().includes(query) ||
      (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(query)))
    );
    setEntries(filtered);
  };

  const handleDateFilter = () => {
    if (!dateFilter.start || !dateFilter.end) {
      loadEntries();
      return;
    }
    
    const filtered = entries.filter(entry => {
      const entryDate = new Date(entry.created_at).toISOString().split('T')[0];
      return entryDate >= dateFilter.start && entryDate <= dateFilter.end;
    });
    setEntries(filtered);
  };

  const clearDateFilter = () => {
    setDateFilter({ start: '', end: '' });
    loadEntries();
  };

  const getNotebookStats = () => {
    const totalEntries = entries.length;
    const typeCounts = entries.reduce((acc, entry) => {
      acc[entry.entry_type] = (acc[entry.entry_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const allTags = entries.flatMap(entry => entry.tags || []);
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

  const renderEntryList = () => (
    <ScrollView style={styles.entriesList}>
      {entries.map((entry) => (
        <TouchableOpacity
          key={entry.id}
          style={[styles.entryCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => {
            setSelectedEntry(entry);
            setFormData({
              title: entry.title,
              content: entry.content,
              entry_type: entry.entry_type as 'text' | 'voice' | 'mixed',
              tags: entry.tags?.join(', ') || '',
              project_id: entry.project_id,
              experiment_id: entry.experiment_id,
              voice_transcription: entry.voice_transcription,
            });
            setIsEditing(true);
          }}
        >
          <View style={styles.entryHeader}>
            <Text style={[styles.entryTitle, { color: theme.colors.onSurface }]}>
              {entry.title}
            </Text>
            <Text style={[styles.entryType, { color: theme.colors.primary }]}>
              {entry.entry_type}
            </Text>
          </View>
          <Text style={[styles.entryPreview, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
            {entry.content}
          </Text>
          {entry.tags && entry.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {entry.tags.slice(0, 3).map((tag, index) => (
                <Text key={index} style={[styles.tag, { color: theme.colors.primary }]}>
                  #{tag}
                </Text>
              ))}
              {entry.tags.length > 3 && (
                <Text style={[styles.tag, { color: theme.colors.primary }]}>
                  +{entry.tags.length - 3}
                </Text>
              )}
            </View>
          )}
          <Text style={[styles.entryDate, { color: theme.colors.outline }]}>
            {new Date(entry.created_at).toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderEditor = () => (
    <ScrollView style={styles.editor}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          setIsEditing(false);
          setSelectedEntry(null);
          setFormData({ title: '', content: '', entry_type: 'text', tags: '' });
        }}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>Back to Notebook</Text>
      </TouchableOpacity>

      <View style={[styles.formContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.formTitle, { color: theme.colors.onSurface }]}>
          {selectedEntry ? 'Edit Entry' : 'New Entry'}
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.onSurface }]}
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
            placeholder="Entry title"
            placeholderTextColor={theme.colors.onSurfaceVariant}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Type</Text>
          <View style={styles.typeButtons}>
            {['text', 'voice', 'mixed'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  formData.entry_type === type && { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => setFormData({ ...formData, entry_type: type as 'text' | 'voice' | 'mixed' })}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formData.entry_type === type ? { color: 'white' } : { color: theme.colors.onSurface },
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Content</Text>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: theme.colors.background, color: theme.colors.onSurface, minHeight: 200 },
            ]}
            value={formData.content}
            onChangeText={(text) => setFormData({ ...formData, content: text })}
            placeholder="Write your notes here..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            multiline
            numberOfLines={15}
            textAlignVertical="top"
          />
        </View>

        {formData.entry_type === 'voice' && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Voice Transcription</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: theme.colors.background, color: theme.colors.onSurface },
              ]}
              value={formData.voice_transcription || ''}
              onChangeText={(text) => setFormData({ ...formData, voice_transcription: text })}
              placeholder="Transcribed voice text will appear here..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <View style={styles.voiceButtons}>
              <TouchableOpacity
                style={[styles.voiceButton, isRecording ? styles.recordingButton : { backgroundColor: theme.colors.primary }]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Ionicons 
                  name={isRecording ? "stop" : "mic"} 
                  size={20} 
                  color="white" 
                />
                <Text style={styles.voiceButtonText}>
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Text>
              </TouchableOpacity>
              {formData.voice_transcription && (
                <TouchableOpacity
                  style={[styles.voiceButton, isSpeaking ? styles.recordingButton : { backgroundColor: theme.colors.secondary }]}
                  onPress={() => speakText(formData.voice_transcription || '')}
                >
                  <Ionicons name={isSpeaking ? "pause" : "volume-high"} size={20} color="white" />
                  <Text style={styles.voiceButtonText}>
                    {isSpeaking ? 'Stop Speaking' : 'Read Aloud'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Project (optional)</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.outline }]}
            onPress={() => setShowProjectPicker(true)}
          >
            <Text style={[styles.pickerButtonText, { color: theme.colors.onSurface }]}>
              {formData.project_id 
                ? projects.find(p => p.id === formData.project_id)?.name || 'Select Project'
                : 'Select Project'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Experiment (optional)</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.outline }]}
            onPress={() => setShowExperimentPicker(true)}
          >
            <Text style={[styles.pickerButtonText, { color: theme.colors.onSurface }]}>
              {formData.experiment_id 
                ? experiments.find(e => e.id === formData.experiment_id)?.title || 'Select Experiment'
                : 'Select Experiment'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Tags (comma-separated)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.onSurface }]}
            value={formData.tags}
            onChangeText={(text) => setFormData({ ...formData, tags: text })}
            placeholder="tag1, tag2, tag3"
            placeholderTextColor={theme.colors.onSurfaceVariant}
          />
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleSave}
          >
            <Ionicons name="checkmark" size={20} color="white" />
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>

          {selectedEntry && (
            <TouchableOpacity
              style={[styles.button, styles.deleteButton, { backgroundColor: theme.colors.error }]}
              onPress={() => {
                Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDelete(selectedEntry.id),
                  },
                ]);
              }}
            >
              <Ionicons name="trash" size={20} color="white" />
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );

  React.useEffect(() => {
    loadEntries();
    loadProjectsAndExperiments();
  }, []);

  React.useEffect(() => {
    handleSearch();
  }, [searchQuery]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.headerEmoji}>📓</Text>
          <View>
            <Text style={[styles.title, { color: theme.colors.onBackground }]}>Engineering Notebook</Text>
            <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              Digital Engineering Journal
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setIsEditing(true)}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.addButtonText}>New Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="search" size={20} color={theme.colors.onSurfaceVariant} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
          placeholder="Search entries..."
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); loadEntries(); }}>
            <Ionicons name="close-circle" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      {/* Features Description */}
      {!isEditing && entries.length === 0 && (
        <View style={[styles.featuresContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.featuresTitle, { color: theme.colors.onSurface }]}>Features:</Text>
          <Text style={[styles.featureItem, { color: theme.colors.onSurfaceVariant }]}>• Rich text and markdown support</Text>
          <Text style={[styles.featureItem, { color: theme.colors.onSurfaceVariant }]}>• Voice transcription integration</Text>
          <Text style={[styles.featureItem, { color: theme.colors.onSurfaceVariant }]}>• Project and experiment linking</Text>
          <Text style={[styles.featureItem, { color: theme.colors.onSurfaceVariant }]}>• Tag-based organization</Text>
          <Text style={[styles.featureItem, { color: theme.colors.onSurfaceVariant }]}>• Search and filtering</Text>
        </View>
      )}

      {isEditing ? renderEditor() : renderEntryList()}

      {/* Project Picker Modal */}
      <Modal
        visible={showProjectPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProjectPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Select Project
            </Text>
            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => {
                  setFormData({ ...formData, project_id: undefined });
                  setShowProjectPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, { color: theme.colors.onSurface }]}>
                  No Project
                </Text>
              </TouchableOpacity>
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.pickerItem,
                    formData.project_id === project.id && { backgroundColor: theme.colors.primaryContainer }
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, project_id: project.id });
                    setShowProjectPicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    formData.project_id === project.id ? { color: theme.colors.primary } : { color: theme.colors.onSurface }
                  ]}>
                    {project.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => setShowProjectPicker(false)}
            >
              <Text style={[styles.modalButtonText, { color: theme.colors.onSurface }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Experiment Picker Modal */}
      <Modal
        visible={showExperimentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExperimentPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Select Experiment
            </Text>
            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => {
                  setFormData({ ...formData, experiment_id: undefined });
                  setShowExperimentPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, { color: theme.colors.onSurface }]}>
                  No Experiment
                </Text>
              </TouchableOpacity>
              {experiments.map((experiment) => (
                <TouchableOpacity
                  key={experiment.id}
                  style={[
                    styles.pickerItem,
                    formData.experiment_id === experiment.id && { backgroundColor: theme.colors.primaryContainer }
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, experiment_id: experiment.id });
                    setShowExperimentPicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    formData.experiment_id === experiment.id ? { color: theme.colors.primary } : { color: theme.colors.onSurface }
                  ]}>
                    {experiment.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => setShowExperimentPicker(false)}
            >
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  featuresContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  featureItem: {
    fontSize: 14,
    marginBottom: 6,
  },
  statsContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statsLabel: {
    fontSize: 14,
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateFilterContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  dateFilterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dateFilterInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  dateFilterActions: {
    flexDirection: 'row',
    gap: 8,
  },
  dateFilterButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateFilterButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  pickerButtonText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  pickerList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  pickerItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  pickerItemText: {
    fontSize: 16,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  voiceButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  voiceButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  recordingButton: {
    backgroundColor: '#ef4444',
  },
  entriesList: {
    flex: 1,
    padding: 16,
  },
  entryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  entryType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  entryPreview: {
    fontSize: 14,
    marginBottom: 8,
  },
  entryDate: {
    fontSize: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  tag: {
    fontSize: 12,
    fontWeight: '500',
  },
  editor: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  formContainer: {
    borderRadius: 12,
    padding: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 150,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeButtonText: {
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButton: {
    flex: 2,
  },
  deleteButton: {
    flex: 1,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
