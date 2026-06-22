# React Native Mobile App Changes

This document describes the changes required for the React Native mobile app to integrate with the three-tier Lab R&D Operating System architecture.

## Overview

The mobile app needs to:
- Read all lab data from Supabase (structured data mirror)
- Create/edit notebook entries via Supabase
- Download heavy files from B2 via Instapods signed URLs
- Support offline operation with queueing

## Installation

### Install Supabase Client

```bash
npm install @supabase/supabase-js
# or
yarn add @supabase/supabase-js
```

### Install AsyncStorage (for auth persistence)

```bash
npm install @react-native-async-storage/async-storage
# or
yarn add @react-native-async-storage/async-storage
```

### Install NetInfo (for network detection)

```bash
npm install @react-native-community/netinfo
# or
yarn add @react-native-community/netinfo
```

---

## Environment Variables

Add to your `.env` file:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_INSTAPODS_URL=https://your-instapods-domain.com
```

---

## File: lib/supabase.js

Create this file to initialize the Supabase client with AsyncStorage for auth persistence.

```javascript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY } from '@env'

// Custom AsyncStorage adapter for Supabase
const AsyncStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
}

// Initialize Supabase client
const supabase = createClient(
  EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

export default supabase
```

---

## File: lib/api.js

Create this file with all API functions for data access and note management.

```javascript
import supabase from './supabase'
import { EXPO_PUBLIC_INSTAPODS_URL } from '@env'

// ============================================
// DATA QUERIES (Read from Supabase)
// ============================================

/**
 * Get all R&D logs ordered by updated_at descending
 * Excludes tombstoned (deleted) records
 */
export async function getAllRdLogs() {
  const { data, error } = await supabase
    .from('rd_logs')
    .select('*')
    .eq('is_tombstone', 0)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}

/**
 * Get all equipment ordered by updated_at descending
 * Excludes tombstoned records
 */
export async function getEquipment() {
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('is_tombstone', 0)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}

/**
 * Get all components ordered by updated_at descending
 * Excludes tombstoned records
 */
export async function getComponents() {
  const { data, error } = await supabase
    .from('components')
    .select('*')
    .eq('is_tombstone', 0)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}

/**
 * Get all findings ordered by updated_at descending
 * Excludes tombstoned records
 */
export async function getFindings() {
  const { data, error } = await supabase
    .from('findings')
    .select('*')
    .eq('is_tombstone', 0)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}

/**
 * Get all notebook entries ordered by updated_at descending
 * Excludes tombstoned records
 */
export async function getNotes() {
  const { data, error } = await supabase
    .from('notebook_entries')
    .select('*')
    .eq('is_tombstone', 0)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}

/**
 * Get notebook entries filtered by source
 * @param {string} source - 'pc' or 'mobile'
 */
export async function getNotesBySource(source) {
  const { data, error } = await supabase
    .from('notebook_entries')
    .select('*')
    .eq('is_tombstone', 0)
    .eq('source', source)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}

// ============================================
// NOTE MANAGEMENT (Write to Supabase)
// ============================================

/**
 * Create a new notebook entry
 * @param {Object} note - Note object with title, content, etc.
 * @returns {Object} Created note data
 */
export async function createNote(note) {
  const noteData = {
    ...note,
    source: 'mobile',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from('notebook_entries')
    .insert(noteData)
    .select()
    .single()
  
  if (error) throw error
  return data
}

/**
 * Update an existing notebook entry
 * @param {string} id - Note UUID
 * @param {Object} changes - Fields to update
 * @returns {Object} Updated note data
 */
export async function updateNote(id, changes) {
  const updateData = {
    ...changes,
    source: 'mobile',
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from('notebook_entries')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

/**
 * Soft delete a notebook entry (set is_tombstone=1)
 * @param {string} id - Note UUID
 */
export async function deleteNote(id) {
  const { error } = await supabase
    .from('notebook_entries')
    .update({ 
      is_tombstone: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  
  if (error) throw error
}

// ============================================
// FILE ACCESS (Signed URLs from Instapods)
// ============================================

/**
 * Get a signed URL for downloading a file from B2
 * @param {string} filename - The filename in B2 bucket
 * @returns {string} Signed URL
 */
export async function getSignedUrl(filename) {
  const jwtToken = await getJwtToken() // Implement your JWT token retrieval
  
  const response = await fetch(
    `${EXPO_PUBLIC_INSTAPODS_URL}/signed-url?filename=${encodeURIComponent(filename)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
    }
  )
  
  if (!response.ok) {
    throw new Error(`Failed to get signed URL: ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.signed_url
}

/**
 * Helper function to get JWT token
 * The JWT token should be the same as JWT_SECRET configured on Instapods Hub
 * For development, you can hardcode it. For production, store it securely.
 */
async function getJwtToken() {
  // In production, this should be stored securely (e.g., in AsyncStorage after secure login)
  // For now, use the same JWT_SECRET that's configured on Instapods Hub
  // This is a simplified approach - in production, implement proper authentication
  
  const jwtSecret = 'your-jwt-secret-here' // Must match INSTAPODS JWT_SECRET
  
  // Try to get from AsyncStorage first (if previously stored)
  try {
    const storedToken = await AsyncStorage.getItem('instapods_jwt_token')
    if (storedToken) return storedToken
  } catch (e) {
    // AsyncStorage not available or error
  }
  
  return jwtSecret
}

/**
 * Store JWT token for future use
 */
export async function setJwtToken(token) {
  try {
    await AsyncStorage.setItem('instapods_jwt_token', token)
  } catch (e) {
    console.error('Failed to store JWT token:', e)
  }
}

// ============================================
// PROJECTS
// ============================================

/**
 * Get all projects
 */
export async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('is_tombstone', 0)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}

/**
 * Get project by ID
 */
export async function getProjectById(id) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('is_tombstone', 0)
    .single()
  
  if (error) throw error
  return data
}

// ============================================
// KNOWLEDGE VAULT
// ============================================

/**
 * Get all knowledge vault documents
 */
export async function getKnowledgeVault() {
  const { data, error } = await supabase
    .from('knowledge_vault')
    .select('*')
    .eq('is_tombstone', 0)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}

/**
 * Get knowledge vault documents by project
 */
export async function getKnowledgeVaultByProject(projectId) {
  const { data, error } = await supabase
    .from('knowledge_vault')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_tombstone', 0)
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data
}

// ============================================
// FILE UPLOAD
// ============================================

/**
 * Upload a file to B2 via Instapods Hub
 * @param {File} file - The file to upload
 * @param {string} filename - The filename to use in B2
 * @returns {Object} Upload result with filename and URL
 */
export async function uploadFile(file, filename) {
  const jwtToken = await getJwtToken()
  
  const formData = new FormData()
  formData.append('file', file)
  formData.append('filename', filename)
  
  const response = await fetch(
    `${EXPO_PUBLIC_INSTAPODS_URL}/upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        // Don't set Content-Type for FormData - let the browser set it with boundary
      },
      body: formData,
    }
  )
  
  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`)
  }
  
  const data = await response.json()
  return data
}

/**
 * Upload a file with automatic offline queueing
 */
export async function uploadFileWithQueue(file, filename) {
  const online = await isOnline()
  
  if (online) {
    try {
      return await uploadFile(file, filename)
    } catch (error) {
      console.log('Online upload failed, queueing operation')
      await queueOperation({
        type: 'uploadFile',
        data: { filename },
        timestamp: Date.now(),
      })
      throw error
    }
  } else {
    await queueOperation({
      type: 'uploadFile',
      data: { filename },
      timestamp: Date.now(),
    })
    return { queued: true, filename }
  }
}

// ============================================
// REAL-TIME SUBSCRIPTIONS (Optional)
// ============================================

/**
 * Subscribe to notebook_entries changes
 * @param {Function} callback - Callback function for changes
 */
export function subscribeToNotes(callback) {
  const subscription = supabase
    .channel('notebook_entries_changes')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'notebook_entries',
        filter: 'is_tombstone=eq.0',
      },
      (payload) => callback(payload)
    )
    .subscribe()
  
  return subscription
}
```

---

## File: lib/offlineQueue.js

Create this file to handle offline operation with AsyncStorage queueing.

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createNote, updateNote } from './api'
import NetInfo from '@react-native-community/netinfo'

const QUEUE_KEY = 'offline_queue'

/**
 * Queue an operation for later execution when online
 * @param {Object} operation - Operation to queue { type, data, timestamp }
 */
export async function queueOperation(operation) {
  try {
    const existingQueue = await getQueue()
    const updatedQueue = [...existingQueue, operation]
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue))
    console.log('Operation queued:', operation.type)
  } catch (error) {
    console.error('Failed to queue operation:', error)
  }
}

/**
 * Get the current offline queue
 */
async function getQueue() {
  try {
    const queueJson = await AsyncStorage.getItem(QUEUE_KEY)
    return queueJson ? JSON.parse(queueJson) : []
  } catch (error) {
    console.error('Failed to get queue:', error)
    return []
  }
}

/**
 * Clear the offline queue
 */
async function clearQueue() {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY)
  } catch (error) {
    console.error('Failed to clear queue:', error)
  }
}

/**
 * Flush the offline queue when network is available
 * Executes operations in order they were queued
 */
export async function flushQueue() {
  try {
    const queue = await getQueue()
    
    if (queue.length === 0) {
      console.log('No operations to flush')
      return
    }
    
    console.log(`Flushing ${queue.length} queued operations...`)
    
    for (const operation of queue) {
      try {
        await executeOperation(operation)
        console.log(`Executed: ${operation.type}`)
      } catch (error) {
        console.error(`Failed to execute ${operation.type}:`, error)
        // Continue with next operation even if this one fails
      }
    }
    
    // Clear queue after attempting to flush all operations
    await clearQueue()
    console.log('Queue flushed successfully')
    
  } catch (error) {
    console.error('Failed to flush queue:', error)
  }
}

/**
 * Execute a single queued operation
 */
async function executeOperation(operation) {
  switch (operation.type) {
    case 'createNote':
      return await createNote(operation.data)
    
    case 'updateNote':
      return await updateNote(operation.data.id, operation.data.changes)
    
    case 'deleteNote':
      // Implement deleteNote if needed
      // return await deleteNote(operation.data.id)
      console.log('Delete note operation:', operation.data)
      break
    
    case 'uploadFile':
      // File uploads cannot be retried from queue without the actual file data
      // In production, you'd need to store the file in AsyncStorage or cache
      console.log('File upload operation (file data not preserved in queue):', operation.data.filename)
      break
    
    default:
      console.warn('Unknown operation type:', operation.type)
  }
}

/**
 * Set up network listener to auto-flush queue when online
 */
export function setupNetworkListener() {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      console.log('Network available, flushing queue...')
      flushQueue()
    }
  })
  
  return unsubscribe
}

/**
 * Check if device is online
 */
export async function isOnline() {
  const state = await NetInfo.fetch()
  return state.isConnected && state.isInternetReachable
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Create a note with automatic offline queueing
 */
export async function createNoteWithQueue(note) {
  const online = await isOnline()
  
  if (online) {
    try {
      return await createNote(note)
    } catch (error) {
      // If online but request fails, queue it
      console.log('Online request failed, queueing operation')
      await queueOperation({
        type: 'createNote',
        data: note,
        timestamp: Date.now(),
      })
      throw error
    }
  } else {
    // Queue for later
    await queueOperation({
      type: 'createNote',
      data: note,
      timestamp: Date.now(),
    })
    return { queued: true, note }
  }
}

/**
 * Update a note with automatic offline queueing
 */
export async function updateNoteWithQueue(id, changes) {
  const online = await isOnline()
  
  if (online) {
    try {
      return await updateNote(id, changes)
    } catch (error) {
      // If online but request fails, queue it
      console.log('Online request failed, queueing operation')
      await queueOperation({
        type: 'updateNote',
        data: { id, changes },
        timestamp: Date.now(),
      })
      throw error
    }
  } else {
    // Queue for later
    await queueOperation({
      type: 'updateNote',
      data: { id, changes },
      timestamp: Date.now(),
    })
    return { queued: true, id, changes }
  }
}
```

---

## Integration Example

### App.js or Main Component

```javascript
import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import { setupNetworkListener } from './lib/offlineQueue'
import supabase from './lib/supabase'

export default function App() {
  useEffect(() => {
    // Set up network listener for offline queue
    const unsubscribe = setupNetworkListener()
    
    // Check auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Auth session:', session ? 'Active' : 'None')
    })
    
    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <View>
      <Text>Lab R&D Mobile App</Text>
    </View>
  )
}
```

### Example: Notes Screen

```javascript
import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { getNotes, createNoteWithQueue } from './lib/api'
import { isOnline } from './lib/offlineQueue'

export default function NotesScreen() {
  const [notes, setNotes] = useState([])
  const [isDeviceOnline, setIsDeviceOnline] = useState(false)

  useEffect(() => {
    loadNotes()
    checkOnlineStatus()
  }, [])

  const loadNotes = async () => {
    try {
      const data = await getNotes()
      setNotes(data)
    } catch (error) {
      console.error('Failed to load notes:', error)
    }
  }

  const checkOnlineStatus = async () => {
    const online = await isOnline()
    setIsDeviceOnline(online)
  }

  const handleCreateNote = async () => {
    try {
      const result = await createNoteWithQueue({
        title: 'New Note',
        content: 'Note content here',
        entry_type: 'text',
      })
      
      if (result.queued) {
        alert('Note queued for sync when online')
      } else {
        loadNotes() // Refresh list
      }
    } catch (error) {
      alert('Failed to create note: ' + error.message)
    }
  }

  return (
    <View>
      <Text>Notes ({isDeviceOnline ? 'Online' : 'Offline'})</Text>
      <TouchableOpacity onPress={handleCreateNote}>
        <Text>Create Note</Text>
      </TouchableOpacity>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>{item.title}</Text>
            <Text>{item.source}</Text>
          </View>
        )}
      />
    </View>
  )
}
```

---

## Testing

### Test Supabase Connection

```javascript
import supabase from './lib/supabase'

async function testConnection() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('Supabase connection failed:', error)
  } else {
    console.log('Supabase connection successful:', data)
  }
}
```

### Test Offline Queue

```javascript
import { queueOperation, flushQueue, isOnline } from './lib/offlineQueue'

async function testQueue() {
  const online = await isOnline()
  console.log('Online:', online)
  
  // Queue a test operation
  await queueOperation({
    type: 'createNote',
    data: { title: 'Test Note', content: 'Test content' },
    timestamp: Date.now(),
  })
  
  // Flush queue
  await flushQueue()
}
```

### Test Signed URL

```javascript
import { getSignedUrl } from './lib/api'

async function testSignedUrl() {
  try {
    const url = await getSignedUrl('example-file.pdf')
    console.log('Signed URL:', url)
  } catch (error) {
    console.error('Failed to get signed URL:', error)
  }
}
```

---

## Migration Notes

If migrating from an existing mobile app:

1. **Replace direct API calls** with Supabase client calls
2. **Update authentication** to use Supabase Auth
3. **Add offline queueing** for write operations
4. **Update file download logic** to use signed URLs from Instapods
5. **Add network status monitoring** for offline/online transitions

---

## Troubleshooting

### Supabase Connection Issues

- Verify EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are correct
- Check that Supabase project is active
- Ensure RLS policies allow anon key access

### Offline Queue Not Flushing

- Check NetInfo is properly configured
- Verify network listener is set up
- Check AsyncStorage permissions

### Signed URL Failures

- Verify EXPO_PUBLIC_INSTAPODS_URL is correct
- Check JWT token is valid
- Ensure Instapods Hub is running and accessible

---

## Additional Resources

- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)
- [React Native NetInfo](https://github.com/react-native-netinfo/react-native-netinfo)
