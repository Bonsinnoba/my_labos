import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Privacy Policy
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Data Collection
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            The Lab R&D Mobile App collects the following data to provide its services:
          </Text>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Device information for sync coordination
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Usage analytics to improve app performance
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Crash reports for bug fixing
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Data Storage
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            Your data is stored securely using:
          </Text>
          <View style={styles.listItem}>
            <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Local encrypted storage on your device
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Encrypted cloud backup via Backblaze B2
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              No third-party data sharing
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Your Rights
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            You have the right to:
          </Text>
          <View style={styles.listItem}>
            <Ionicons name="finger-print" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Access all your personal data
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="finger-print" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Request deletion of your data
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="finger-print" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Export your data at any time
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="finger-print" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Opt-out of analytics collection
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Contact
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            For privacy-related questions or concerns, please contact us at:
          </Text>
          <Text style={[styles.link, { color: theme.colors.primary }]}>
            privacy@lab-rd-app.com
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
            Last updated: January 2025
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  link: {
    fontSize: 16,
    marginTop: 8,
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
