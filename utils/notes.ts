// Notes Management System for Alfie
// Supports text notes, links, and image attachments

import { supabase, isSupabaseConfigured } from './supabase';

export interface AlfieNote {
  id: string;
  created_at: string;
  updated_at: string;
  title?: string;
  content: string;
  note_type: 'text' | 'link' | 'image' | 'file';
  url?: string;
  file_name?: string;
  file_url?: string;
  file_size?: number;
  file_type?: string;
  tags?: string[];
  is_pinned: boolean;
  is_archived: boolean;
  color?: string;
  display_order: number;
}

const STORAGE_KEY = 'alfie-notes-local';
const BUCKET_NAME = 'alfie-notes';

// ============================================================================
// LOCAL STORAGE FUNCTIONS (Fallback when Supabase not configured)
// ============================================================================

function getLocalNotes(): AlfieNote[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load local notes:', e);
    return [];
  }
}

function saveLocalNotes(notes: AlfieNote[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save local notes:', e);
  }
}

// ============================================================================
// SUPABASE FUNCTIONS
// ============================================================================

/**
 * Fetch all active (non-archived) notes from Supabase
 */
export async function fetchNotes(includeArchived = false): Promise<AlfieNote[]> {
  // Fallback to local storage if Supabase not configured
  if (!isSupabaseConfigured()) {
    const localNotes = getLocalNotes();
    return includeArchived ? localNotes : localNotes.filter(n => !n.is_archived);
  }

  try {
    let query = supabase!
      .from('alfie_notes')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    // If table doesn't exist (404), fall back to local storage
    if (error) {
      console.warn('Supabase notes table not found. Using local storage. Run migration 002 to enable cloud sync.');
      return getLocalNotes().filter(n => includeArchived || !n.is_archived);
    }
    
    return data || [];
  } catch (error) {
    console.warn('Failed to fetch notes from Supabase, using local storage:', error);
    return getLocalNotes().filter(n => includeArchived || !n.is_archived);
  }
}

/**
 * Create a new text note
 */
export async function createTextNote(
  content: string,
  title?: string,
  tags?: string[],
  color?: string
): Promise<AlfieNote | null> {
  const newNote: Partial<AlfieNote> = {
    content,
    title,
    note_type: 'text',
    tags,
    color: color || 'default',
    is_pinned: false,
    is_archived: false,
    display_order: 0
  };

  if (!isSupabaseConfigured()) {
    // Local storage fallback
    const localNote: AlfieNote = {
      ...newNote,
      id: `note-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_pinned: false,
      is_archived: false,
      display_order: 0
    } as AlfieNote;

    const notes = getLocalNotes();
    notes.unshift(localNote);
    saveLocalNotes(notes);
    return localNote;
  }

  try {
    const { data, error } = await supabase!
      .from('alfie_notes')
      .insert([newNote])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to create text note:', error);
    return null;
  }
}

/**
 * Create a new link note
 */
export async function createLinkNote(
  url: string,
  title?: string,
  content?: string,
  tags?: string[]
): Promise<AlfieNote | null> {
  const newNote: Partial<AlfieNote> = {
    content: content || url,
    title: title || new URL(url).hostname,
    note_type: 'link',
    url,
    tags,
    is_pinned: false,
    is_archived: false,
    display_order: 0
  };

  if (!isSupabaseConfigured()) {
    // Local storage fallback
    const localNote: AlfieNote = {
      ...newNote,
      id: `note-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_pinned: false,
      is_archived: false,
      display_order: 0
    } as AlfieNote;

    const notes = getLocalNotes();
    notes.unshift(localNote);
    saveLocalNotes(notes);
    return localNote;
  }

  try {
    const { data, error } = await supabase!
      .from('alfie_notes')
      .insert([newNote])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to create link note:', error);
    return null;
  }
}

/**
 * Upload an image and create an image note
 */
export async function uploadImage(
  file: File,
  title?: string,
  content?: string,
  tags?: string[]
): Promise<AlfieNote | null> {
  if (!isSupabaseConfigured()) {
    console.warn('Image upload requires Supabase configuration');
    return null;
  }

  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase!
      .storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase!
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Create note record
    const newNote: Partial<AlfieNote> = {
      content: content || `Image: ${file.name}`,
      title: title || file.name,
      note_type: 'image',
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      file_type: file.type,
      tags,
      is_pinned: false,
      is_archived: false,
      display_order: 0
    };

    const { data, error } = await supabase!
      .from('alfie_notes')
      .insert([newNote])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to upload image:', error);
    return null;
  }
}

/**
 * Update an existing note
 */
export async function updateNote(
  id: string,
  updates: Partial<AlfieNote>
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    // Local storage fallback
    const notes = getLocalNotes();
    const index = notes.findIndex(n => n.id === id);
    if (index !== -1) {
      notes[index] = { ...notes[index], ...updates, updated_at: new Date().toISOString() };
      saveLocalNotes(notes);
      return true;
    }
    return false;
  }

  try {
    const { error } = await supabase!
      .from('alfie_notes')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to update note:', error);
    return false;
  }
}

/**
 * Delete a note (and its associated file if it's an image)
 */
export async function deleteNote(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    // Local storage fallback
    const notes = getLocalNotes();
    const filtered = notes.filter(n => n.id !== id);
    saveLocalNotes(filtered);
    return true;
  }

  try {
    // Get note to check if it has a file
    const { data: note } = await supabase!
      .from('alfie_notes')
      .select('*')
      .eq('id', id)
      .single();

    // Delete file from storage if exists
    if (note && note.file_url) {
      const fileName = note.file_url.split('/').pop();
      if (fileName) {
        await supabase!.storage.from(BUCKET_NAME).remove([fileName]);
      }
    }

    // Delete note record
    const { error } = await supabase!
      .from('alfie_notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to delete note:', error);
    return false;
  }
}

/**
 * Toggle pin status
 */
export async function togglePin(id: string, isPinned: boolean): Promise<boolean> {
  return updateNote(id, { is_pinned: isPinned });
}

/**
 * Archive/unarchive a note
 */
export async function toggleArchive(id: string, isArchived: boolean): Promise<boolean> {
  return updateNote(id, { is_archived: isArchived });
}

/**
 * Get combined notes summary for Alfie (for context in conversations)
 */
export async function getNotesContext(): Promise<string> {
  const notes = await fetchNotes(false); // Only active notes
  
  if (notes.length === 0) {
    return '';
  }

  const sections: string[] = [];

  // Pinned notes first
  const pinnedNotes = notes.filter(n => n.is_pinned);
  if (pinnedNotes.length > 0) {
    sections.push('📌 PINNED NOTES:');
    pinnedNotes.forEach(note => {
      sections.push(`• ${note.title || note.content.substring(0, 100)}`);
    });
  }

  // Text notes
  const textNotes = notes.filter(n => n.note_type === 'text' && !n.is_pinned);
  if (textNotes.length > 0) {
    sections.push('\n📝 TEXT NOTES:');
    textNotes.forEach(note => {
      sections.push(`• ${note.content.substring(0, 200)}`);
    });
  }

  // Links
  const linkNotes = notes.filter(n => n.note_type === 'link');
  if (linkNotes.length > 0) {
    sections.push('\n🔗 REFERENCE LINKS:');
    linkNotes.forEach(note => {
      sections.push(`• ${note.title}: ${note.url}`);
    });
  }

  // Images
  const imageNotes = notes.filter(n => n.note_type === 'image');
  if (imageNotes.length > 0) {
    sections.push('\n📷 ATTACHED IMAGES:');
    imageNotes.forEach(note => {
      sections.push(`• ${note.title} (${note.file_url})`);
    });
  }

  return sections.join('\n');
}

