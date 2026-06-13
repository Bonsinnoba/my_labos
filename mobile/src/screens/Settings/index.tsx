import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme, Switch } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { useAppStore } from '../../store';
import Card from '../../components/common/Card';

export default function SettingsScreen() {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeStore();
  const { isOnline, lastSync } = useAppStore();
  const [autoSync, setAutoSync] = React.useState(true);
  const [notifications, setNotifications] = React.useState(true);

  const settingsSections = [
    {
      title: 'Appearance',
      items: [
        {
          icon: 'moon',
          label: 'Dark Mode',
          type: 'switch',
          value: isDark,
          onValueChange: toggleTheme,
        },
        {
          icon: 'color-palette',
          label: 'Theme Color',
          type: 'navigation',
          value: 'Orange',
        },
      ],
    },
    {
      title: 'Sync',
      items: [
        {
          icon: 'sync',
          label: 'Auto-sync',
          type: 'switch',
          value: autoSync,
          onValueChange: setAutoSync,
        },
        {
          icon: 'time',
          label: 'Sync Interval',
          type: 'navigation',
          value: '5 minutes',
        },
        {
          icon: 'cloud-upload',
          label: 'Sync Now',
          type: 'button',
          onPress: () => console.log('Sync now'),
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: 'notifications',
          label: 'Push Notifications',
          type: 'switch',
          value: notifications,
          onValueChange: setNotifications,
        },
        {
          icon: 'mail',
          label: 'Email Notifications',
          type: 'switch',
          value: false,
          onValueChange: () => {},
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'person',
          label: 'Profile',
          type: 'navigation',
          value: 'Dr. Smith',
        },
        {
          icon: 'key',
          label: 'Change Password',
          type: 'navigation',
        },
        {
          icon: 'shield-checkmark',
          label: 'Privacy',
          type: 'navigation',
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          icon: 'information-circle',
          label: 'App Version',
          type: 'info',
          value: '1.0.0',
        },
        {
          icon: 'document-text',
          label: 'Terms of Service',
          type: 'navigation',
        },
        {
          icon: 'help-circle',
          label: 'Help & Support',
          type: 'navigation',
        },
      ],
    },
  ];

  const renderSettingItem = (item: any) => {
    switch (item.type) {
      case 'switch':
        return (
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name={item.icon as any} size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>
                {item.label}
              </Text>
            </View>
            <Switch value={item.value} onValueChange={item.onValueChange} />
          </View>
        );
      case 'navigation':
        return (
          <TouchableOpacity style={styles.settingRow} onPress={() => console.log(`Navigate to ${item.label}`)}>
            <View style={styles.settingLeft}>
              <Ionicons name={item.icon as any} size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>
                {item.label}
              </Text>
            </View>
            <View style={styles.settingRight}>
              {item.value && (
                <Text style={[styles.settingValue, { color: theme.colors.onSurfaceVariant }]}>
                  {item.value}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />
            </View>
          </TouchableOpacity>
        );
      case 'button':
        return (
          <TouchableOpacity
            style={[styles.buttonRow, { backgroundColor: theme.colors.primary }]}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon as any} size={20} color="white" />
            <Text style={styles.buttonText}>{item.label}</Text>
          </TouchableOpacity>
        );
      case 'info':
        return (
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name={item.icon as any} size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>
                {item.label}
              </Text>
            </View>
            <Text style={[styles.settingValue, { color: theme.colors.onSurfaceVariant }]}>
              {item.value}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Settings
        </Text>
      </View>

      {/* Sync Status */}
      <Card elevation={0} style={styles.syncCard}>
        <View style={styles.syncStatusRow}>
          <View style={[styles.syncIndicator, { backgroundColor: isOnline ? theme.colors.success : theme.colors.error }]} />
          <View style={styles.syncInfo}>
            <Text style={[styles.syncStatusText, { color: theme.colors.onSurface }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Text style={[styles.syncLastSync, { color: theme.colors.onSurfaceVariant }]}>
              Last sync: {lastSync || 'Never'}
            </Text>
          </View>
          <TouchableOpacity style={[styles.syncButton, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="sync" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </Card>

      {/* Settings Sections */}
      {settingsSections.map((section, index) => (
        <Card key={index} elevation={0} style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {section.title}
          </Text>
          {section.items.map((item, itemIndex) => (
            <View key={itemIndex} style={itemIndex < section.items.length - 1 && styles.itemDivider}>
              {renderSettingItem(item)}
            </View>
          ))}
        </Card>
      ))}

      {/* Logout */}
      <TouchableOpacity style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}>
        <Ionicons name="log-out" size={20} color="white" />
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>

      <View style={styles.footer} />
    </ScrollView>
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
  syncCard: {
    margin: 16,
    marginBottom: 8,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  syncIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  syncInfo: {
    flex: 1,
  },
  syncStatusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  syncLastSync: {
    fontSize: 12,
    marginTop: 2,
  },
  syncButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 12,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    marginRight: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  itemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    height: 20,
  },
});
