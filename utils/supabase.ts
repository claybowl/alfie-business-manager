import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured. Cloud sync will be unavailable.');
  console.warn('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Type definitions for database rows
export interface BriefingSnapshot {
  id: string;
  created_at: string;
  timestamp: string;
  system_status: string;
  active_projects: any;
  recent_decisions: any;
  timeline: any;
  events: any;
  linear_issues: any;
  notion_pages: any;
  user_notes: string;
  raw_context: string;
  data_sources: any;
}

export interface ConversationRow {
  id: string;
  session_id: string;
  start_time: string;
  end_time: string | null;
  summary: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  timestamp: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'voice';
  created_at: string;
}

export interface SyncMetadata {
  id: string;
  last_sync_at: string;
  sync_type: 'briefing' | 'conversation';
  status: 'success' | 'failed';
  error_message: string | null;
  records_synced: number;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

/**
 * Log sync operation to metadata table
 */
export async function logSyncOperation(
  syncType: 'briefing' | 'conversation',
  status: 'success' | 'failed',
  recordsSynced: number,
  errorMessage?: string
): Promise<void> {
  if (!supabase) return;

  try {
    await supabase
      .from('sync_metadata')
      .insert({
        last_sync_at: new Date().toISOString(),
        sync_type: syncType,
        status,
        error_message: errorMessage || null,
        records_synced: recordsSynced
      });
  } catch (error) {
    console.error('Failed to log sync operation:', error);
  }
}

/**
 * Get the last sync timestamp for a given sync type
 */
export async function getLastSyncTimestamp(syncType: 'briefing' | 'conversation'): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('sync_metadata')
      .select('last_sync_at')
      .eq('sync_type', syncType)
      .eq('status', 'success')
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.last_sync_at;
  } catch (error) {
    console.error('Failed to get last sync timestamp:', error);
    return null;
  }
}
