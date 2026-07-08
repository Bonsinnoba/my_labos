import supabase from './supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'

const INSTAPODS_URL = process.env.EXPO_PUBLIC_INSTAPODS_URL || ''

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
 * @param source - 'pc' or 'mobile'
 */
export async function getNotesBySource(source: string) {
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
 * @param note - Note object with title, content, etc.
 * @returns Created note data
 */
export async function createNote(note: any) {
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
 * @param id - Note UUID
 * @param changes - Fields to update
 * @returns Updated note data
 */
export async function updateNote(id: string, changes: any) {
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
 * @param id - Note UUID
 */
export async function deleteNote(id: string) {
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
// FILE ACCESS (Download from Instapods Hub)
// ============================================

/**
 * Download a file from Instapods Hub (direct download, no caching on server)
 * @param filename - The filename in B2 bucket
 * @param fileSize - Optional file size in bytes to determine storage bucket
 * @returns File blob
 */
export async function downloadFile(filename: string, fileSize?: number): Promise<Blob> {
  const jwtToken = await getJwtToken()
  
  let url = `${INSTAPODS_URL}/download/${encodeURIComponent(filename)}`
  if (fileSize) {
    url += `?file_size=${fileSize}`
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`)
  }
  
  return await response.blob()
}

/**
 * Download a file using mobile cache manager
 * Files are cached locally on the mobile device with 72-hour expiry
 * @param filename - The filename in B2 bucket
 * @param fileSize - Optional file size in bytes to determine storage bucket
 * @returns Local file path or null if download fails
 */
export async function downloadFileWithCache(filename: string, fileSize?: number): Promise<string | null> {
  const { fileCacheManager } = await import('../services/cache/fileCache');
  return await fileCacheManager.getFile(filename, fileSize);
}

/**
 * Get a signed URL for downloading a file from B2 (LEGACY - use downloadFile instead)
 * @param filename - The filename in B2 bucket
 * @returns Signed URL
 * @deprecated Use downloadFile() instead for cached downloads
 */
export async function getSignedUrl(filename: string) {
  const jwtToken = await getJwtToken()
  
  const response = await fetch(
    `${INSTAPODS_URL}/signed-url?filename=${encodeURIComponent(filename)}`,
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
 */
async function getJwtToken() {
  // In production, this should be stored securely
  const jwtSecret = 'your-jwt-secret-here' // Must match INSTAPODS JWT_SECRET
  
  // Try to get from AsyncStorage first
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
export async function setJwtToken(token: string) {
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
export async function getProjectById(id: string) {
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
export async function getKnowledgeVaultByProject(projectId: string) {
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
 * @param file - The file to upload
 * @param filename - The filename to use in B2
 * @returns Upload result with filename and URL
 */
export async function uploadFile(file: any, filename: string) {
  const jwtToken = await getJwtToken()
  
  const formData = new FormData()
  formData.append('file', file)
  formData.append('filename', filename)
  
  const response = await fetch(
    `${INSTAPODS_URL}/upload`,
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

// ============================================
// REAL-TIME SUBSCRIPTIONS (Optional)
// ============================================

/**
 * Subscribe to notebook_entries changes
 * @param callback - Callback function for changes
 */
export function subscribeToNotes(callback: (payload: any) => void) {
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
