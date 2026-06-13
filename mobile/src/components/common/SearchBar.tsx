import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
}

export default function SearchBar({ placeholder = 'Search...', onSearch }: SearchBarProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const handleSearch = (text: string) => {
    setQuery(text);
    onSearch(text);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TextInput
        mode="outlined"
        placeholder={placeholder}
        value={query}
        onChangeText={handleSearch}
        left={
          <TextInput.Icon
            icon={() => <Ionicons name="search" size={20} color={theme.colors.onSurfaceVariant} />}
          />
        }
        right={
          query ? (
            <TextInput.Icon
              icon={() => <Ionicons name="close-circle" size={20} color={theme.colors.onSurfaceVariant} />}
              onPress={() => {
                setQuery('');
                onSearch('');
              }}
            />
          ) : undefined
        }
        style={styles.input}
        outlineStyle={styles.outline}
        contentStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    backgroundColor: 'transparent',
  },
  outline: {
    borderRadius: 12,
    borderWidth: 1,
  },
  content: {
    minHeight: 40,
  },
});
