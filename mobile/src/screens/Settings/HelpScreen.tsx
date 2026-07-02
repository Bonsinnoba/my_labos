import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Linking } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';

export default function HelpScreen() {
  const theme = useTheme();

  const faqData = [
    {
      question: 'How do I sync my data?',
      answer: 'Data syncs automatically in the background and is also triggered by live actions like saving or deleting content.',
    },
    {
      question: 'What happens when I\'m offline?',
      answer: 'The app caches your data locally when offline. Changes are queued and will sync automatically when you regain internet connection.',
    },
    {
      question: 'How do I change the theme?',
      answer: 'Go to Settings > Appearance to toggle dark mode or change the theme color. Your preference is saved automatically.',
    },
    {
      question: 'How do I configure cloud storage?',
      answer: 'Go to Settings and configure your Backblaze B2 credentials. This enables direct cloud access for your mobile device.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, all data is encrypted both in transit and at rest. We use industry-standard encryption for cloud storage.',
    },
  ];

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@lab-rd-app.com');
  };

  const handleViewDocumentation = () => {
    Linking.openURL('https://docs.lab-rd-app.com');
  };

  const handleReportBug = () => {
    Linking.openURL('mailto:bugs@lab-rd-app.com?subject=Bug Report');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Help & Support
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <Card elevation={0} style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
            Quick Actions
          </Text>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleEmailSupport}
          >
            <Ionicons name="mail" size={20} color="white" />
            <Text style={styles.actionButtonText}>Email Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}
            onPress={handleViewDocumentation}
          >
            <Ionicons name="book" size={20} color="white" />
            <Text style={styles.actionButtonText}>View Documentation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
            onPress={handleReportBug}
          >
            <Ionicons name="bug" size={20} color="white" />
            <Text style={styles.actionButtonText}>Report a Bug</Text>
          </TouchableOpacity>
        </Card>

        {/* FAQ Section */}
        <Card elevation={0} style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
            Frequently Asked Questions
          </Text>
          
          {faqData.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <View style={styles.faqQuestion}>
                <Ionicons name="help-circle" size={20} color={theme.colors.primary} />
                <Text style={[styles.faqQuestionText, { color: theme.colors.onSurface }]}>
                  {faq.question}
                </Text>
              </View>
              <Text style={[styles.faqAnswer, { color: theme.colors.onSurfaceVariant }]}>
                {faq.answer}
              </Text>
              {index < faqData.length - 1 && <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />}
            </View>
          ))}
        </Card>

        {/* Contact Information */}
        <Card elevation={0} style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
            Contact Information
          </Text>
          
          <View style={styles.contactItem}>
            <Ionicons name="mail" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.onSurfaceVariant }]}>
              support@lab-rd-app.com
            </Text>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="globe" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.onSurfaceVariant }]}>
              www.lab-rd-app.com
            </Text>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="document-text" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.onSurfaceVariant }]}>
              docs.lab-rd-app.com
            </Text>
          </View>
        </Card>

        {/* App Info */}
        <Card elevation={0} style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
            App Information
          </Text>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
              Version
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
              1.0.0
            </Text>
          </View>
          
          <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
              Build
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
              2025.01.20
            </Text>
          </View>
          
          <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
              Platform
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
              React Native
            </Text>
          </View>
        </Card>

        <View style={styles.footer} />
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
  card: {
    marginBottom: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  faqQuestionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 28,
  },
  divider: {
    height: 1,
    marginTop: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    marginLeft: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    height: 20,
  },
});
