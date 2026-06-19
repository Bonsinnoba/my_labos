import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { toolsApi } from '../../services/api';

export default function ToolsScreen({ navigation }: any) {
  const theme = useTheme();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const tools = [
    { id: 'ohms-law', name: "Ohm's Law", icon: 'flash', description: 'Calculate voltage, current, or resistance' },
    { id: 'voltage-divider', name: 'Voltage Divider', icon: 'git-branch', description: 'Calculate output voltage from divider circuit' },
    { id: 'power', name: 'Power Calculator', icon: 'flash', description: 'Calculate electrical power' },
    { id: 'led-resistor', name: 'LED Resistor', icon: 'bulb', description: 'Calculate resistor for LED circuit' },
    { id: 'battery-runtime', name: 'Battery Runtime', icon: 'battery-full', description: 'Calculate battery life' },
    { id: 'rc-time-constant', name: 'RC Time Constant', icon: 'time', description: 'Calculate RC circuit time constant' },
    { id: 'lc-resonant-frequency', name: 'LC Resonant Frequency', icon: 'pulse', description: 'Calculate LC resonant frequency' },
    { id: 'scientific-calculator', name: 'Scientific Calculator', icon: 'calculator', description: 'Evaluate mathematical expressions' },
    { id: 'statistics', name: 'Statistics', icon: 'stats-chart', description: 'Calculate basic statistics' },
    { id: 'matrix-multiply', name: 'Matrix Multiplication', icon: 'grid', description: 'Multiply two matrices' },
  ];

  const getInputFields = (toolId: string) => {
    const fields: Record<string, { label: string; key: string }[]> = {
      'ohms-law': [
        { label: 'Voltage (V)', key: 'voltage' },
        { label: 'Current (A)', key: 'current' },
        { label: 'Resistance (Ω)', key: 'resistance' },
      ],
      'voltage-divider': [
        { label: 'Input Voltage (V)', key: 'vin' },
        { label: 'Resistor 1 (Ω)', key: 'r1' },
        { label: 'Resistor 2 (Ω)', key: 'r2' },
      ],
      'power': [
        { label: 'Voltage (V)', key: 'voltage' },
        { label: 'Current (A)', key: 'current' },
        { label: 'Resistance (Ω)', key: 'resistance' },
      ],
      'led-resistor': [
        { label: 'Supply Voltage (V)', key: 'voltage' },
        { label: 'LED Voltage (V)', key: 'led_voltage' },
        { label: 'LED Current (A)', key: 'led_current' },
      ],
      'battery-runtime': [
        { label: 'Battery Capacity (mAh)', key: 'capacity' },
        { label: 'Current Draw (mA)', key: 'current_draw' },
      ],
      'rc-time-constant': [
        { label: 'Resistance (Ω)', key: 'resistance' },
        { label: 'Capacitance (F)', key: 'capacitance' },
      ],
      'lc-resonant-frequency': [
        { label: 'Inductance (H)', key: 'inductance' },
        { label: 'Capacitance (F)', key: 'capacitance' },
      ],
      'scientific-calculator': [
        { label: 'Expression', key: 'expression' },
      ],
      'statistics': [
        { label: 'Data (comma-separated)', key: 'data' },
      ],
      'matrix-multiply': [
        { label: 'Matrix A (JSON)', key: 'matrix_a' },
        { label: 'Matrix B (JSON)', key: 'matrix_b' },
      ],
    };
    return fields[toolId] || [];
  };

  const handleCalculate = async () => {
    if (!selectedTool) return;

    try {
      setLoading(true);
      let response: any;

      switch (selectedTool) {
        case 'ohms-law':
          response = await toolsApi.ohmsLaw({
            voltage: inputs.voltage ? parseFloat(inputs.voltage) : undefined,
            current: inputs.current ? parseFloat(inputs.current) : undefined,
            resistance: inputs.resistance ? parseFloat(inputs.resistance) : undefined,
          });
          break;
        case 'voltage-divider':
          response = await toolsApi.voltageDivider({
            vin: parseFloat(inputs.vin),
            r1: parseFloat(inputs.r1),
            r2: parseFloat(inputs.r2),
          });
          break;
        case 'power':
          response = await toolsApi.power({
            voltage: inputs.voltage ? parseFloat(inputs.voltage) : undefined,
            current: inputs.current ? parseFloat(inputs.current) : undefined,
            resistance: inputs.resistance ? parseFloat(inputs.resistance) : undefined,
          });
          break;
        case 'led-resistor':
          response = await toolsApi.ledResistor({
            voltage: parseFloat(inputs.voltage),
            led_voltage: parseFloat(inputs.led_voltage),
            led_current: parseFloat(inputs.led_current),
          });
          break;
        case 'battery-runtime':
          response = await toolsApi.batteryRuntime({
            capacity: parseFloat(inputs.capacity),
            current_draw: parseFloat(inputs.current_draw),
          });
          break;
        case 'rc-time-constant':
          response = await toolsApi.rcTimeConstant({
            resistance: parseFloat(inputs.resistance),
            capacitance: parseFloat(inputs.capacitance),
          });
          break;
        case 'lc-resonant-frequency':
          response = await toolsApi.lcResonantFrequency({
            inductance: parseFloat(inputs.inductance),
            capacitance: parseFloat(inputs.capacitance),
          });
          break;
        case 'scientific-calculator':
          response = await toolsApi.scientificCalculator({
            expression: inputs.expression,
          });
          break;
        case 'statistics':
          response = await toolsApi.statistics({
            data: inputs.data.split(',').map((n) => parseFloat(n.trim())),
          });
          break;
        case 'matrix-multiply':
          response = await toolsApi.matrixMultiply({
            matrix_a: JSON.parse(inputs.matrix_a),
            matrix_b: JSON.parse(inputs.matrix_b),
          });
          break;
        default:
          throw new Error('Unknown tool');
      }

      setResult(response);
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate. Please check your inputs.');
      console.error('Calculation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const renderToolSelection = () => (
    <ScrollView style={styles.toolsGrid} showsVerticalScrollIndicator={false}>
      {tools.map((tool) => (
        <TouchableOpacity
          key={tool.id}
          style={[styles.toolCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => setSelectedTool(tool.id)}
        >
          <View style={[styles.toolIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Ionicons name={tool.icon as any} size={32} color={theme.colors.primary} />
          </View>
          <Text style={[styles.toolName, { color: theme.colors.onSurface }]}>{tool.name}</Text>
          <Text style={[styles.toolDescription, { color: theme.colors.onSurfaceVariant }]}>
            {tool.description}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderToolInterface = () => {
    const tool = tools.find((t) => t.id === selectedTool);
    const inputFields = getInputFields(selectedTool!);

    return (
      <ScrollView style={styles.toolInterface} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedTool(null);
            setInputs({});
            setResult(null);
          }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>Back to Tools</Text>
        </TouchableOpacity>

        <View style={[styles.toolHeader, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.toolIconLarge, { backgroundColor: theme.colors.primaryContainer }]}>
            <Ionicons name={tool?.icon as any} size={40} color={theme.colors.primary} />
          </View>
          <Text style={[styles.toolTitle, { color: theme.colors.onSurface }]}>{tool?.name}</Text>
          <Text style={[styles.toolDesc, { color: theme.colors.onSurfaceVariant }]}>
            {tool?.description}
          </Text>
        </View>

        <View style={styles.inputsContainer}>
          {inputFields.map((field) => (
            <View key={field.key} style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.onSurface }]}>{field.label}</Text>
              <TextInput
                style={[
                  styles.input,
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
                keyboardType="decimal-pad"
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.calculateButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleCalculate}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.calculateButtonText}>Calculating...</Text>
            ) : (
              <>
                <Ionicons name="calculator" size={20} color="white" />
                <Text style={styles.calculateButtonText}>Calculate</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {result && (
          <View style={[styles.resultContainer, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.resultTitle, { color: theme.colors.onSurface }]}>Result</Text>
            <Text style={[styles.resultText, { color: theme.colors.primary }]}>
              {JSON.stringify(result, null, 2)}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>Engineering Tools</Text>
      </View>

      {selectedTool ? renderToolInterface() : renderToolSelection()}
    </View>
  );
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
  toolsGrid: {
    flex: 1,
    padding: 16,
  },
  toolCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  toolIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  toolName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  toolDescription: {
    fontSize: 14,
  },
  toolInterface: {
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
  toolHeader: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  toolIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  toolTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  toolDesc: {
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
  calculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  calculateButtonText: {
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
    fontFamily: 'monospace',
  },
});
