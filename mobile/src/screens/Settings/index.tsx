import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, SafeAreaView } from 'react-native';
import { useTheme, Switch } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { useAppStore } from '../../store';
import { useSettingsStore } from '../../store/settingsStore';
import Card from '../../components/common/Card';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../services/api';
import { cloudClient, CloudConfig } from '../../services/cloud/cloudClient';
import { syncService } from '../../services/sync/syncService';
import { pinService } from '../../services/pinService';

export default function SettingsScreen({ navigation }: any) {
  const theme = useTheme();
  const { isDark, toggleTheme } = useThemeStore();
  const { isOnline, lastSync } = useAppStore();
  
  // Use settings store
  const {
    autoSync,
    syncInterval,
    pushNotifications,
    emailNotifications,
    userName,
    themeColor,
    apiBaseUrl,
    setAutoSync,
    setSyncInterval,
    setPushNotifications,
    setEmailNotifications,
    setUserName,
    setThemeColor,
    setApiBaseUrl,
  } = useSettingsStore();
  
  // Local UI state
  const [showApiInput, setShowApiInput] = React.useState(false);
  const [showCloudConfig, setShowCloudConfig] = React.useState(false);
  const [showThemeColorPicker, setShowThemeColorPicker] = React.useState(false);
  const [showSyncIntervalPicker, setShowSyncIntervalPicker] = React.useState(false);
  const [showProfile, setShowProfile] = React.useState(false);
  const [hasPin, setHasPin] = React.useState(false);
  const [pinEnabled, setPinEnabled] = React.useState(false);
  
  // Cloud settings
  const [cloudEnabled, setCloudEnabled] = React.useState(false);
  const [cloudConfig, setCloudConfig] = React.useState<Partial<CloudConfig>>({
    account1Endpoint: 'https://s3.eu-central-003.backblazeb2.com',
    account1KeyId: '',
    account1ApplicationKey: '',
    account1Bucket: 'lab-heavy-storage',
    account2Endpoint: 'https://s3.eu-central-003.backblazeb2.com',
    account2KeyId: '',
    account2ApplicationKey: '',
    account2Bucket: 'lab-light-storage',
    encryptionKey: '',
    enableEncryption: true,
  });

  const saveApiUrl = async (url: string) => {
    try {
      await apiClient.updateBaseURL(url);
      setApiBaseUrl(url);
      setShowApiInput(false);
      Alert.alert('Success', 'API URL saved and updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to save API URL');
    }
  };

  const saveCloudConfig = async () => {
    try {
      if (!cloudConfig.account1KeyId || !cloudConfig.account1ApplicationKey ||
          !cloudConfig.account2KeyId || !cloudConfig.account2ApplicationKey) {
        Alert.alert('Error', 'Please fill in all required Backblaze B2 credentials');
        return;
      }

      if (cloudConfig.enableEncryption && cloudConfig.encryptionKey && cloudConfig.encryptionKey.length !== 64) {
        Alert.alert('Error', 'Encryption key must be 64 characters (32 bytes hex)');
        return;
      }

      const fullConfig: CloudConfig = {
        account1Endpoint: cloudConfig.account1Endpoint || 'https://s3.eu-central-003.backblazeb2.com',
        account1KeyId: cloudConfig.account1KeyId,
        account1ApplicationKey: cloudConfig.account1ApplicationKey,
        account1Bucket: cloudConfig.account1Bucket || 'lab-heavy-storage',
        account2Endpoint: cloudConfig.account2Endpoint || 'https://s3.eu-central-003.backblazeb2.com',
        account2KeyId: cloudConfig.account2KeyId,
        account2ApplicationKey: cloudConfig.account2ApplicationKey,
        account2Bucket: cloudConfig.account2Bucket || 'lab-light-storage',
        encryptionKey: cloudConfig.encryptionKey || '',
        enableEncryption: cloudConfig.enableEncryption || false,
      };

      await cloudClient.saveConfig(fullConfig);
      setCloudEnabled(true);
      setShowCloudConfig(false);
      Alert.alert('Success', 'Cloud configuration saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save cloud configuration');
    }
  };

  const toggleCloudMode = async () => {
    if (cloudEnabled) {
      setCloudEnabled(false);
      await apiClient.setCloudMode(false);
      Alert.alert('Cloud Disabled', 'Mobile app will use PC API server');
    } else {
      const initialized = await cloudClient.initialize();
      if (initialized) {
        setCloudEnabled(true);
        await apiClient.setCloudMode(true);
        Alert.alert('Cloud Enabled', 'Mobile app will access cloud directly');
      } else {
        Alert.alert('Error', 'Cloud not configured. Please configure cloud settings first.');
        setShowCloudConfig(true);
      }
    }
  };

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load cloud enabled status
      const cloudStatus = await AsyncStorage.getItem('@cloud_enabled');
      if (cloudStatus) {
        setCloudEnabled(cloudStatus === 'true');
      }
      
      // Load PIN status
      const pinExists = await pinService.hasPin();
      setHasPin(pinExists);
      const pinStatus = await pinService.isPinEnabled();
      setPinEnabled(pinStatus);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear auth token and sensitive data
              await AsyncStorage.multiRemove(['auth_token', '@user_data']);
              // Reset settings to defaults
              useSettingsStore.getState().resetSettings();
              Alert.alert('Logged Out', 'You have been logged out successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to log out');
            }
          },
        },
      ]
    );
  };

  const handleManualSync = async () => {
    try {
      const result = await syncService.syncNow();
      if (result.success) {
        Alert.alert('Sync Complete', result.message);
        // Update last sync time in app store
        useAppStore.getState().setLastSync(Date.now());
      } else {
        Alert.alert('Sync Failed', result.message);
      }
    } catch (error) {
      Alert.alert('Sync Error', 'An error occurred during sync');
    }
  };

  const handleAutoSyncToggle = async (value: boolean) => {
    setAutoSync(value);
    try {
      await syncService.toggleSync(value);
      // Convert minutes to milliseconds for syncService
      const intervalMs = syncInterval * 60 * 1000;
      await syncService.updateSyncInterval(intervalMs);
    } catch (error) {
      console.error('Error toggling auto-sync:', error);
    }
  };

  const handleSyncIntervalChange = async (value: number) => {
    setSyncInterval(value);
    try {
      // Convert minutes to milliseconds for syncService
      const intervalMs = value * 60 * 1000;
      await syncService.updateSyncInterval(intervalMs);
    } catch (error) {
      console.error('Error updating sync interval:', error);
    }
  };

  const handleSetPin = () => {
    navigation.navigate('PINSetup', { mode: 'set' });
  };

  const handleChangePin = () => {
    navigation.navigate('PINSetup', { mode: 'change' });
  };

  const handleRemovePin = () => {
    Alert.alert(
      'Remove PIN',
      'Are you sure you want to remove your PIN? This will reduce the security of your app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await pinService.removePin();
            if (result.success) {
              setHasPin(false);
              setPinEnabled(false);
              Alert.alert('Success', 'PIN removed successfully');
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  };

  const handleResetPinState = () => {
    Alert.alert(
      'Reset PIN State',
      'This will clear all PIN-related data and reset the PIN system. Use this if you are experiencing PIN-related issues.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const result = await pinService.clearPinState();
            if (result.success) {
              setHasPin(false);
              setPinEnabled(false);
              Alert.alert('Success', 'PIN state reset successfully');
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  };

  const handleTogglePinEnabled = async (value: boolean) => {
    const result = await pinService.togglePinEnabled(value);
    if (result.success) {
      setPinEnabled(value);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const getColorHex = (colorName: string): string => {
    const colors: Record<string, string> = {
      'Orange': '#FF9800',
      'Blue': '#2196F3',
      'Green': '#4CAF50',
      'Purple': '#9C27B0',
      'Red': '#F44336',
      'Teal': '#009688',
    };
    return colors[colorName] || '#FF9800';
  };

  const settingsSections = [
    {
      title: 'Security',
      items: [
        {
          icon: 'lock-closed',
          label: 'PIN Lock',
          type: 'switch',
          value: pinEnabled,
          onValueChange: handleTogglePinEnabled,
          disabled: !hasPin,
        },
        ...(hasPin ? [
          {
            icon: 'key',
            label: 'Change PIN',
            type: 'navigation',
            onPress: handleChangePin,
          },
          {
            icon: 'trash',
            label: 'Remove PIN',
            type: 'navigation',
            onPress: handleRemovePin,
          },
          {
            icon: 'refresh',
            label: 'Reset PIN State',
            type: 'navigation',
            onPress: handleResetPinState,
          },
        ] : [
          {
            icon: 'add-circle',
            label: 'Set PIN',
            type: 'navigation',
            onPress: handleSetPin,
          },
          {
            icon: 'refresh',
            label: 'Reset PIN State',
            type: 'navigation',
            onPress: handleResetPinState,
          },
        ]),
      ],
    },
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
          value: themeColor,
          onPress: () => setShowThemeColorPicker(true),
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
          onValueChange: handleAutoSyncToggle,
        },
        {
          icon: 'time',
          label: 'Sync Interval',
          type: 'navigation',
          value: `${syncInterval} minutes`,
          onPress: () => setShowSyncIntervalPicker(true),
        },
        {
          icon: 'cloud-upload',
          label: 'Sync Now',
          type: 'button',
          onPress: () => handleManualSync(),
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
          value: pushNotifications,
          onValueChange: setPushNotifications,
        },
        {
          icon: 'mail',
          label: 'Email Notifications',
          type: 'switch',
          value: emailNotifications,
          onValueChange: setEmailNotifications,
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
          value: userName,
          onPress: () => setShowProfile(true),
        },
        {
          icon: 'shield-checkmark',
          label: 'Privacy',
          type: 'navigation',
          onPress: () => navigation.navigate('Privacy'),
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
          onPress: () => navigation.navigate('Terms'),
        },
        {
          icon: 'help-circle',
          label: 'Help & Support',
          type: 'navigation',
          onPress: () => navigation.navigate('Help'),
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
          <TouchableOpacity 
            style={styles.settingRow} 
            onPress={item.onPress}
          >
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Settings
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContent}
      >
        {/* Sync Status */}
        <Card elevation={0} style={styles.syncCard}>
          <View style={styles.syncStatusRow}>
            <View style={[styles.syncIndicator, { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }]} />
            <View style={styles.syncInfo}>
              <Text style={[styles.syncStatusText, { color: theme.colors.onSurface }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
              <Text style={[styles.syncLastSync, { color: theme.colors.onSurfaceVariant }]}>
                Last sync: {lastSync || 'Never'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.syncButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => Alert.alert('Sync', 'Manual sync initiated')}
            >
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
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
          onPress={() => handleLogout()}
        >
          <Ionicons name="log-out" size={20} color="white" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <View style={styles.footer} />
      </ScrollView>

      {/* Modals - Fixed at center */}
      {/* API URL Input Modal */}
      {showApiInput && (
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Configure API URL
            </Text>
            <TextInput
              style={[styles.modalInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline
              }]}
              value={apiBaseUrl}
              onChangeText={setApiBaseUrl}
              placeholder="http://192.168.100.5:8000"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => setShowApiInput(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave, { backgroundColor: theme.colors.primary }]}
                onPress={() => saveApiUrl(apiBaseUrl)}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Theme Color Picker Modal */}
      {showThemeColorPicker && (
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Theme Color
            </Text>
            <View style={styles.colorPickerContainer}>
              {['Orange', 'Blue', 'Green', 'Purple', 'Red', 'Teal'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    themeColor === color && { borderColor: theme.colors.primary, borderWidth: 3 },
                    { backgroundColor: getColorHex(color) }
                  ]}
                  onPress={() => {
                    setThemeColor(color);
                    setShowThemeColorPicker(false);
                  }}
                >
                  {themeColor === color && (
                    <Ionicons name="checkmark" size={24} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => setShowThemeColorPicker(false)}
            >
              <Text style={[styles.modalButtonText, { color: theme.colors.onSurface }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sync Interval Picker Modal */}
      {showSyncIntervalPicker && (
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Sync Interval
            </Text>
            {[1, 5, 10, 15, 30, 60].map((interval) => (
              <TouchableOpacity
                key={interval}
                style={[
                  styles.intervalOption,
                  syncInterval === interval && { backgroundColor: theme.colors.primaryContainer }
                ]}
                onPress={() => {
                  handleSyncIntervalChange(interval);
                  setShowSyncIntervalPicker(false);
                }}
              >
                <Text style={[
                  styles.intervalText,
                  { color: theme.colors.onSurface },
                  syncInterval === interval && { color: theme.colors.primary }
                ]}>
                  {interval} minute{interval > 1 ? 's' : ''}
                </Text>
                {syncInterval === interval && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => setShowSyncIntervalPicker(false)}
            >
              <Text style={[styles.modalButtonText, { color: theme.colors.onSurface }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Profile
            </Text>
            <Text style={[styles.modalDescription, { color: theme.colors.onSurfaceVariant }]}>
              User Name
            </Text>
            <TextInput
              style={[styles.modalInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline
              }]}
              value={userName}
              onChangeText={setUserName}
              placeholder="Enter your name"
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => setShowProfile(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  // Save userName to settings store
                  setUserName(userName);
                  setShowProfile(false);
                }}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Cloud Configuration Modal */}
      {showCloudConfig && (
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, maxHeight: '80%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
                Backblaze B2 Configuration
              </Text>
              <Text style={[styles.modalDescription, { color: theme.colors.onSurfaceVariant }]}>
                Configure dual-account Backblaze B2 for 20GB free tier maximization
              </Text>

              <Text style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
                Account #1 (Heavy Storage - 50MB and above)
              </Text>
              <TextInput
                style={[styles.modalInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline
                }]}
                value={cloudConfig.account1KeyId}
                onChangeText={(text) => setCloudConfig({ ...cloudConfig, account1KeyId: text })}
                placeholder="Account #1 Key ID"
                placeholderTextColor={theme.colors.onSurfaceVariant}
              />
              <TextInput
                style={[styles.modalInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline
                }]}
                value={cloudConfig.account1ApplicationKey}
                onChangeText={(text) => setCloudConfig({ ...cloudConfig, account1ApplicationKey: text })}
                placeholder="Account #1 Application Key"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                secureTextEntry
              />
              <TextInput
                style={[styles.modalInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline
                }]}
                value={cloudConfig.account1Bucket}
                onChangeText={(text) => setCloudConfig({ ...cloudConfig, account1Bucket: text })}
                placeholder="Account #1 Bucket"
                placeholderTextColor={theme.colors.onSurfaceVariant}
              />

              <Text style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
                Account #2 (Light Storage - under 50MB)
              </Text>
              <TextInput
                style={[styles.modalInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline
                }]}
                value={cloudConfig.account2KeyId}
                onChangeText={(text) => setCloudConfig({ ...cloudConfig, account2KeyId: text })}
                placeholder="Account #2 Key ID"
                placeholderTextColor={theme.colors.onSurfaceVariant}
              />
              <TextInput
                style={[styles.modalInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline
                }]}
                value={cloudConfig.account2ApplicationKey}
                onChangeText={(text) => setCloudConfig({ ...cloudConfig, account2ApplicationKey: text })}
                placeholder="Account #2 Application Key"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                secureTextEntry
              />
              <TextInput
                style={[styles.modalInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline
                }]}
                value={cloudConfig.account2Bucket}
                onChangeText={(text) => setCloudConfig({ ...cloudConfig, account2Bucket: text })}
                placeholder="Account #2 Bucket"
                placeholderTextColor={theme.colors.onSurfaceVariant}
              />

              <Text style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
                Encryption Key (64-character hex)
              </Text>
              <TextInput
                style={[styles.modalInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline
                }]}
                value={cloudConfig.encryptionKey}
                onChangeText={(text) => setCloudConfig({ ...cloudConfig, encryptionKey: text })}
                placeholder="64-character hex encryption key"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                secureTextEntry
              />

              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>
                  Enable Encryption
                </Text>
                <Switch
                  value={cloudConfig.enableEncryption}
                  onValueChange={(value) => setCloudConfig({ ...cloudConfig, enableEncryption: value })}
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: theme.colors.surfaceVariant }]}
                  onPress={() => setShowCloudConfig(false)}
                >
                  <Text style={[styles.modalButtonText, { color: theme.colors.onSurface }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave, { backgroundColor: theme.colors.primary }]}
                  onPress={saveCloudConfig}
                >
                  <Text style={styles.modalButtonText}>Save Configuration</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
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
  },
  scrollContent: {
    flex: 1,
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
  },
  modalButtonCancel: {
    marginRight: 8,
  },
  modalButtonSave: {
    marginLeft: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  colorPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  colorOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    margin: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intervalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  intervalText: {
    fontSize: 16,
  },
});
