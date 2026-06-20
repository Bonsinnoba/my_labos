import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

export default function TermsScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Terms of Service
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Acceptance of Terms
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            By downloading, installing, or using the Lab R&D Mobile App, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Description of Service
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            The Lab R&D Mobile App provides:
          </Text>
          <View style={styles.listItem}>
            <Ionicons name="flask" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Access to lab experiment data
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="flask" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Project management tools
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="flask" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Real-time synchronization with lab systems
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="flask" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Offline data access and caching
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            User Responsibilities
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            As a user, you agree to:
          </Text>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Use the app only for legitimate research purposes
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Maintain the security of your account credentials
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Not attempt to reverse engineer or modify the app
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.listText, { color: theme.colors.onSurfaceVariant }]}>
              Comply with all applicable laws and regulations
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Data Ownership
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            You retain ownership of all data you create or upload to the app. The app provides tools for you to export or delete your data at any time.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Limitation of Liability
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            The Lab R&D Mobile App is provided "as is" without warranties of any kind. We are not liable for any damages arising from the use or inability to use the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Termination
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            We reserve the right to suspend or terminate your access to the app at any time for violation of these terms or for any other reason at our sole discretion.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Changes to Terms
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the new terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Contact
          </Text>
          <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
            For questions about these terms, please contact us at:
          </Text>
          <Text style={[styles.link, { color: theme.colors.primary }]}>
            legal@lab-rd-app.com
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
