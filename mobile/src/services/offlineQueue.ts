import AsyncStorage from '@react-native-async-storage/async-storage'
import { createNote, updateNote, deleteNote } from './api'
import type { NotebookEntry } from './api/services'
import NetInfo from '@react-native-community/netinfo'

const QUEUE_KEY = 'offline_queue'

export type OfflineOperationType = 'createNote' | 'updateNote' | 'deleteNote' | 'uploadFile'

export interface CreateNoteQueueData {
  note: Partial<NotebookEntry>
  tempId: string
}

export interface UpdateNoteQueueData {
  id: string | number
  changes: Partial<NotebookEntry>
}

export interface DeleteNoteQueueData {
  id: string | number
}

export interface OfflineOperation {
  type: OfflineOperationType
  data: CreateNoteQueueData | UpdateNoteQueueData | DeleteNoteQueueData | any
  timestamp: number
}

export interface QueueResult<T = any> {
  success: boolean
  queued: boolean
  data?: T
  id?: string | number
  error?: any
}

/**
 * Queue an operation for later execution when online
 * @param operation - Operation to queue
 */
export async function queueOperation(operation: OfflineOperation) {
  try {
    const existingQueue = await getQueue()
    const updatedQueue = normalizeQueue([...existingQueue], operation)
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue))
    console.log('Operation queued:', operation.type)
  } catch (error) {
    console.error('Failed to queue operation:', error)
  }
}

/**
 * Get the current offline queue
 */
export async function getQueue(): Promise<OfflineOperation[]> {
  try {
    const queueJson = await AsyncStorage.getItem(QUEUE_KEY)
    return queueJson ? JSON.parse(queueJson) : []
  } catch (error) {
    console.error('Failed to get queue:', error)
    return []
  }
}

function normalizeQueue(queue: OfflineOperation[], operation: OfflineOperation): OfflineOperation[] {
  if (operation.type === 'updateNote') {
    const existingCreateIndex = queue.findIndex((item) => item.type === 'createNote' && ((item.data as CreateNoteQueueData).tempId === String((operation.data as UpdateNoteQueueData).id)))
    if (existingCreateIndex >= 0) {
      const existingCreate = queue[existingCreateIndex] as OfflineOperation & { data: CreateNoteQueueData }
      existingCreate.data.note = {
        ...existingCreate.data.note,
        ...((operation.data as UpdateNoteQueueData).changes),
      }
      return queue
    }

    const existingUpdateIndex = queue.findIndex((item) => item.type === 'updateNote' && String((item.data as UpdateNoteQueueData).id) === String((operation.data as UpdateNoteQueueData).id))
    if (existingUpdateIndex >= 0) {
      const existingUpdate = queue[existingUpdateIndex] as OfflineOperation & { data: UpdateNoteQueueData }
      existingUpdate.data.changes = {
        ...existingUpdate.data.changes,
        ...((operation.data as UpdateNoteQueueData).changes),
      }
      return queue
    }
  }

  if (operation.type === 'deleteNote') {
    const targetId = String((operation.data as DeleteNoteQueueData).id)
    const existingCreateIndex = queue.findIndex((item) => item.type === 'createNote' && ((item.data as CreateNoteQueueData).tempId === targetId))
    if (existingCreateIndex >= 0) {
      queue.splice(existingCreateIndex, 1)
      return queue
    }

    const existingUpdateIndex = queue.findIndex((item) => item.type === 'updateNote' && String((item.data as UpdateNoteQueueData).id) === targetId)
    if (existingUpdateIndex >= 0) {
      queue.splice(existingUpdateIndex, 1)
    }
  }

  queue.push(operation)
  return queue
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
async function executeOperation(operation: OfflineOperation) {
  switch (operation.type) {
    case 'createNote': {
      const createData = operation.data as CreateNoteQueueData
      return await createNote(createData.note)
    }

    case 'updateNote': {
      const updateData = operation.data as UpdateNoteQueueData
      return await updateNote(String(updateData.id), updateData.changes)
    }

    case 'deleteNote': {
      const deleteData = operation.data as DeleteNoteQueueData
      return await deleteNote(String(deleteData.id))
    }

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
export async function createNoteWithQueue(note: Partial<NotebookEntry>): Promise<QueueResult> {
  const online = await isOnline()
  const tempId = `offline_${Date.now()}`
  const queuedNote = {
    ...note,
    id: tempId,
    created_at: note.created_at || new Date().toISOString(),
    updated_at: note.updated_at || new Date().toISOString(),
  }

  if (online) {
    try {
      const result = await createNote(note)
      return { success: true, queued: false, data: result }
    } catch (error) {
      console.log('Online request failed, queueing operation')
      await queueOperation({
        type: 'createNote',
        data: { note, tempId },
        timestamp: Date.now(),
      })
      return { success: true, queued: true, data: queuedNote, id: tempId, error }
    }
  } else {
    await queueOperation({
      type: 'createNote',
      data: { note, tempId },
      timestamp: Date.now(),
    })
    return { success: true, queued: true, data: queuedNote, id: tempId }
  }
}

/**
 * Update a note with automatic offline queueing
 */
export async function updateNoteWithQueue(id: string | number, changes: Partial<NotebookEntry>): Promise<QueueResult> {
  const online = await isOnline()

  if (online) {
    try {
      const result = await updateNote(String(id), changes)
      return { success: true, queued: false, data: result }
    } catch (error) {
      console.log('Online request failed, queueing operation')
      await queueOperation({
        type: 'updateNote',
        data: { id: String(id), changes },
        timestamp: Date.now(),
      })
      return { success: true, queued: true, id, error }
    }
  } else {
    await queueOperation({
      type: 'updateNote',
      data: { id: String(id), changes },
      timestamp: Date.now(),
    })
    return { success: true, queued: true, id }
  }
}

/**
 * Delete a note with automatic offline queueing
 */
export async function deleteNoteWithQueue(id: string | number): Promise<QueueResult> {
  const online = await isOnline()

  if (online) {
    try {
      await deleteNote(String(id))
      return { success: true, queued: false, id }
    } catch (error) {
      console.log('Online delete failed, queueing operation')
      await queueOperation({
        type: 'deleteNote',
        data: { id: String(id) },
        timestamp: Date.now(),
      })
      return { success: true, queued: true, id, error }
    }
  } else {
    await queueOperation({
      type: 'deleteNote',
      data: { id: String(id) },
      timestamp: Date.now(),
    })
    return { success: true, queued: true, id }
  }
}

/**
 * Apply queued notebook operations to the current entries state
 */
export async function mergeQueueIntoEntries(entries: NotebookEntry[]): Promise<NotebookEntry[]> {
  const queue = await getQueue()
  if (!queue.length) {
    return entries
  }

  const mergedEntries = [...entries]

  const applyUpdate = (id: string, changes: Partial<NotebookEntry>) => {
    const index = mergedEntries.findIndex((entry) => String(entry.id) === id)
    if (index >= 0) {
      mergedEntries[index] = {
        ...mergedEntries[index],
        ...changes,
        updated_at: changes.updated_at || new Date().toISOString(),
        pendingSync: true,
      }
    }
  }

  for (const operation of queue.sort((a, b) => a.timestamp - b.timestamp)) {
    switch (operation.type) {
      case 'createNote': {
        const createData = operation.data as CreateNoteQueueData
        const tempEntry: NotebookEntry = {
          ...createData.note,
          id: createData.tempId,
          created_at: createData.note.created_at || new Date().toISOString(),
          updated_at: createData.note.updated_at || new Date().toISOString(),
          pendingSync: true,
        } as NotebookEntry

        if (!mergedEntries.some((entry) => String(entry.id) === String(createData.tempId))) {
          mergedEntries.unshift(tempEntry)
        }
        break
      }

      case 'updateNote': {
        const updateData = operation.data as UpdateNoteQueueData
        applyUpdate(String(updateData.id), updateData.changes)
        break
      }

      case 'deleteNote': {
        const deleteData = operation.data as DeleteNoteQueueData
        const index = mergedEntries.findIndex((entry) => String(entry.id) === String(deleteData.id))
        if (index >= 0) {
          mergedEntries.splice(index, 1)
        }
        break
      }

      default:
        break
    }
  }

  return mergedEntries
}
