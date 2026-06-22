import AsyncStorage from '@react-native-async-storage/async-storage'
import { createNote, updateNote } from './api'
import NetInfo from '@react-native-community/netinfo'

const QUEUE_KEY = 'offline_queue'

interface Operation {
  type: string
  data: any
  timestamp: number
}

/**
 * Queue an operation for later execution when online
 * @param operation - Operation to queue
 */
export async function queueOperation(operation: Operation) {
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
async function getQueue(): Promise<Operation[]> {
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
async function executeOperation(operation: Operation) {
  switch (operation.type) {
    case 'createNote':
      return await createNote(operation.data)
    
    case 'updateNote':
      return await updateNote(operation.data.id, operation.data.changes)
    
    case 'deleteNote':
      // Implement deleteNote if needed
      console.log('Delete note operation:', operation.data)
      break
    
    case 'uploadFile':
      // File uploads cannot be retried from queue without the actual file data
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
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch()
  return state.isConnected === true && state.isInternetReachable === true
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Create a note with automatic offline queueing
 */
export async function createNoteWithQueue(note: any) {
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
export async function updateNoteWithQueue(id: string, changes: any) {
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
