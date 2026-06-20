import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, SafeAreaView, Modal } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { geminiApi } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatHistoryItem {
  id: string;
  feature: string;
  question: string;
  response: string;
  timestamp: string;
}

export default function AIScreen({ navigation }: any) {
  const theme = useTheme();
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFeature, setFilterFeature] = useState<string>('all');
  const [selectedChatItem, setSelectedChatItem] = useState<ChatHistoryItem | null>(null);

  const aiFeatures = [
    { 
      id: 'chat-history', 
      name: 'Chat History', 
      icon: 'time', 
      description: 'View all your past AI conversations' 
    },
    { 
      id: 'chat', 
      name: 'AI Assistant', 
      icon: 'chatbubbles', 
      description: 'General AI assistance for lab work' 
    },
    { 
      id: 'stage-review', 
      name: 'Stage Review', 
      icon: 'eye', 
      description: 'Analyze project stages for risks and issues' 
    },
    { 
      id: 'component-alternates', 
      name: 'Component Finder', 
      icon: 'search', 
      description: 'Find pin-compatible component alternatives' 
    },
    { 
      id: 'failure-diagnosis', 
      name: 'Failure Diagnosis', 
      icon: 'warning', 
      description: 'Diagnose circuit failures' 
    },
    { 
      id: 'test-script', 
      name: 'Script Generator', 
      icon: 'code', 
      description: 'Generate test automation scripts' 
    },
  ];

  const getInputFields = (featureId: string) => {
    const fields: Record<string, { label: string; key: string; multiline?: boolean }[]> = {
      'chat': [
        { label: 'Your Message', key: 'message', multiline: true },
      ],
      'stage-review': [
        { label: 'Stage Context (JSON)', key: 'stage_context', multiline: true },
      ],
      'component-alternates': [
        { label: 'Component Details', key: 'component_details', multiline: true },
      ],
      'failure-diagnosis': [
        { label: 'Observation', key: 'observation', multiline: true },
        { label: 'Experiment History (JSON)', key: 'experiment_history', multiline: true },
      ],
      'test-script': [
        { label: 'Requirement', key: 'requirement', multiline: true },
        { label: 'Language (python/cpp/arduino)', key: 'language' },
      ],
    };
    return fields[featureId] || [];
  };

  const handleGenerate = async () => {
    if (!selectedFeature) return;

    try {
      setLoading(true);
      setResult('');
      
      let response: string;

      switch (selectedFeature) {
        case 'chat':
          response = await geminiApi.chat({
            message: inputs.message || '',
            conversation_history: [],
          });
          break;
        case 'stage-review':
          try {
            const stageContext = JSON.parse(inputs.stage_context || '{}');
            response = await geminiApi.reviewStageDesign({ stage_context: stageContext });
          } catch (e) {
            response = 'Invalid JSON format for stage context';
          }
          break;
        case 'component-alternates':
          response = await geminiApi.findComponentAlternates({
            component_details: inputs.component_details || '',
          });
          break;
        case 'failure-diagnosis':
          try {
            const experimentHistory = JSON.parse(inputs.experiment_history || '[]');
            response = await geminiApi.diagnoseCircuitFailure({
              observation: inputs.observation || '',
              experiment_history: experimentHistory,
            });
          } catch (e) {
            response = 'Invalid JSON format for experiment history';
          }
          break;
        case 'test-script':
          response = await geminiApi.generateTestScript({
            requirement: inputs.requirement || '',
            language: inputs.language || 'python',
          });
          break;
        default:
          throw new Error('Unknown feature');
      }

      setResult(response);
      
      // Save to chat history
      const chatItem: ChatHistoryItem = {
        id: Date.now().toString(),
        feature: selectedFeature,
        question: inputs.message || inputs.stage_context || inputs.component_details || inputs.observation || inputs.requirement || '',
        response: response,
        timestamp: new Date().toISOString(),
      };
      await saveChatHistory(chatItem);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate AI response. Please check your connection and API key.');
      console.error('AI error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const loadChatHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('@ai_chat_history');
      if (history) {
        setChatHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveChatHistory = async (item: ChatHistoryItem) => {
    try {
      const updatedHistory = [item, ...chatHistory];
      await AsyncStorage.setItem('@ai_chat_history', JSON.stringify(updatedHistory));
      setChatHistory(updatedHistory);
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const getFilteredChatHistory = () => {
    let filtered = chatHistory;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.question.toLowerCase().includes(query) || 
        item.response.toLowerCase().includes(query)
      );
    }
    
    // Filter by feature
    if (filterFeature !== 'all') {
      filtered = filtered.filter(item => item.feature === filterFeature);
    }
    
    return filtered;
  };

  const deleteChatItem = async (id: string) => {
    try {
      const updatedHistory = chatHistory.filter(item => item.id !== id);
      await AsyncStorage.setItem('@ai_chat_history', JSON.stringify(updatedHistory));
      setChatHistory(updatedHistory);
      setSelectedChatItem(null);
    } catch (error) {
      console.error('Error deleting chat item:', error);
    }
  };

  const renderFeatureSelection = () => (
    <ScrollView style={styles.featuresGrid} showsVerticalScrollIndicator={false}>
      {aiFeatures.map((feature) => (
        <TouchableOpacity
          key={feature.id}
          style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => setSelectedFeature(feature.id)}
        >
          <View style={[styles.featureIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Ionicons name={feature.icon as any} size={32} color={theme.colors.primary} />
          </View>
          <Text style={[styles.featureName, { color: theme.colors.onSurface }]}>{feature.name}</Text>
          <Text style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>
            {feature.description}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderFeatureInterface = () => {
    const feature = aiFeatures.find((f) => f.id === selectedFeature);

    // Handle chat history feature
    if (selectedFeature === 'chat-history') {
      return renderChatHistory();
    }

    const inputFields = getInputFields(selectedFeature!);

    return (
      <ScrollView style={styles.featureInterface} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedFeature(null);
            setInputs({});
            setResult('');
          }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>Back to AI Features</Text>
        </TouchableOpacity>

        <View style={[styles.featureHeader, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.featureIconLarge, { backgroundColor: theme.colors.primaryContainer }]}>
            <Ionicons name={feature?.icon as any} size={40} color={theme.colors.primary} />
          </View>
          <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>{feature?.name}</Text>
          <Text style={[styles.featureDesc, { color: theme.colors.onSurfaceVariant }]}>
            {feature?.description}
          </Text>
        </View>

        <View style={styles.inputsContainer}>
          {inputFields.map((field) => (
            <View key={field.key} style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.onSurface }]}>{field.label}</Text>
              <TextInput
                style={[
                  styles.input,
                  field.multiline ? styles.inputMultiline : styles.inputSingle,
                  {
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.onSurface,
                    borderColor: theme.colors.outline,
                  },
                ]}
                value={inputs[field.key] || ''}
                onChangeText={(value) => handleInputChange(field.key, value)}
                placeholder={`Enter ${field.label}`}
                placeholderTextColor={theme.colors.onSurfaceVariant}
                multiline={field.multiline}
                numberOfLines={field.multiline ? 4 : 1}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.generateButtonText}>Generating...</Text>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="white" />
                <Text style={styles.generateButtonText}>Generate</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {result && (
          <View style={[styles.resultContainer, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.resultTitle, { color: theme.colors.onSurface }]}>AI Response</Text>
            <Text style={[styles.resultText, { color: theme.colors.onSurface }]}>
              {result}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderChatHistory = () => {
    const filteredHistory = getFilteredChatHistory();

    return (
      <ScrollView style={styles.featureInterface} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedFeature(null)}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>Back to AI Features</Text>
        </TouchableOpacity>

        <View style={[styles.featureHeader, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.featureIconLarge, { backgroundColor: theme.colors.primaryContainer }]}>
            <Ionicons name="time" size={40} color={theme.colors.primary} />
          </View>
          <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>Chat History</Text>
          <Text style={[styles.featureDesc, { color: theme.colors.onSurfaceVariant }]}>
            View all your past AI conversations
          </Text>
        </View>

        {/* Search and Filter */}
        <View style={[styles.searchFilterContainer, { backgroundColor: theme.colors.surface }]}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: theme.colors.background, color: theme.colors.onSurface }]}
            placeholder="Search conversations..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterFeature === 'all' && { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => setFilterFeature('all')}
            >
              <Text style={[
                styles.filterButtonText,
                filterFeature === 'all' && { color: 'white' }
              ]}>All</Text>
            </TouchableOpacity>
            {aiFeatures.filter(f => f.id !== 'chat-history').map(feature => (
              <TouchableOpacity
                key={feature.id}
                style={[
                  styles.filterButton,
                  filterFeature === feature.id && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => setFilterFeature(feature.id)}
              >
                <Text style={[
                  styles.filterButtonText,
                  filterFeature === feature.id && { color: 'white' }
                ]}>{feature.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chat History List */}
        <View style={styles.chatHistoryList}>
          {filteredHistory.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              {chatHistory.length === 0 ? 'No chat history yet' : 'No matching conversations found'}
            </Text>
          ) : (
            filteredHistory.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chatHistoryItem, { backgroundColor: theme.colors.surface }]}
                onPress={() => setSelectedChatItem(item)}
              >
                <View style={styles.chatHistoryHeader}>
                  <Text style={[styles.chatHistoryFeature, { color: theme.colors.primary }]}>
                    {aiFeatures.find(f => f.id === item.feature)?.name || item.feature}
                  </Text>
                  <Text style={[styles.chatHistoryDate, { color: theme.colors.onSurfaceVariant }]}>
                    {new Date(item.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.chatHistoryQuestion, { color: theme.colors.onSurface }]} numberOfLines={2}>
                  {item.question}
                </Text>
                <Text style={[styles.chatHistoryResponse, { color: theme.colors.onSurfaceVariant }]} numberOfLines={3}>
                  {item.response}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>AI Assistant</Text>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Powered by Gemini AI
        </Text>
      </View>

      {selectedFeature ? renderFeatureInterface() : renderFeatureSelection()}

      {/* Chat Detail Modal */}
      <Modal
        visible={!!selectedChatItem}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedChatItem(null)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
                  {aiFeatures.find(f => f.id === selectedChatItem?.feature)?.name || selectedChatItem?.feature}
                </Text>
                <TouchableOpacity onPress={() => setSelectedChatItem(null)}>
                  <Ionicons name="close" size={24} color={theme.colors.onSurface} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.chatDetailSection}>
                <Text style={[styles.chatDetailLabel, { color: theme.colors.primary }]}>Question:</Text>
                <Text style={[styles.chatDetailText, { color: theme.colors.onSurface }]}>
                  {selectedChatItem?.question}
                </Text>
              </View>
              
              <View style={styles.chatDetailSection}>
                <Text style={[styles.chatDetailLabel, { color: theme.colors.primary }]}>Response:</Text>
                <Text style={[styles.chatDetailText, { color: theme.colors.onSurface }]}>
                  {selectedChatItem?.response}
                </Text>
              </View>
              
              <View style={styles.chatDetailSection}>
                <Text style={[styles.chatDetailLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Date: {selectedChatItem?.timestamp ? new Date(selectedChatItem.timestamp).toLocaleString() : ''}
                </Text>
              </View>
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
              onPress={() => {
                if (selectedChatItem) {
                  Alert.alert(
                    'Delete Conversation',
                    'Are you sure you want to delete this conversation?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => deleteChatItem(selectedChatItem.id),
                      },
                    ]
                  );
                }
              }}
            >
              <Ionicons name="trash" size={20} color="white" />
              <Text style={styles.deleteButtonText}>Delete Conversation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  useEffect(() => {
    loadChatHistory();
  }, []);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  featuresGrid: {
    flex: 1,
    padding: 16,
  },
  featureCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
  },
  featureInterface: {
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
  featureHeader: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  featureIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  featureDesc: {
    fontSize: 14,
    textAlign: 'center',
  },
  inputsContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
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
  inputSingle: {
    height: 48,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 20,
  },
  searchFilterContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chatHistoryList: {
    paddingBottom: 16,
  },
  chatHistoryItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  chatHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chatHistoryFeature: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  chatHistoryDate: {
    fontSize: 12,
  },
  chatHistoryQuestion: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  chatHistoryResponse: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
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
  modalScrollView: {
    maxHeight: 400,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatDetailSection: {
    marginBottom: 16,
  },
  chatDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chatDetailText: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
