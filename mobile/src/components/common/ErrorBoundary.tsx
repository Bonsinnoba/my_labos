import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
    this.setState({ errorInfo: info.componentStack ?? '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>⚠️ App Error</Text>
          <Text style={styles.subtitle}>{this.state.error?.message}</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.stack}>{this.state.errorInfo}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null, errorInfo: '' })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f87171',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#fbbf24',
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#242424',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  stack: {
    fontSize: 11,
    color: '#a0a0a0',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#ff6b35',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
