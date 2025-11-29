// Conversation History Management for Alfie

import { supabase, isSupabaseConfigured, logSyncOperation } from './supabase';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type: 'voice' | 'chat';
}

export interface ConversationSession {
  id: string;
  startTime: string;
  endTime?: string;
  messages: ConversationMessage[];
  summary?: string;
}

const STORAGE_KEY = 'alfie-conversation-history';
const MAX_SESSIONS = 50; // Keep last 50 conversation sessions

// Get all conversation sessions
export function getAllSessions(): ConversationSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load conversation history:', e);
    return [];
  }
}

// Get current active session or create new one
let currentSessionId: string | null = null;

export function startNewSession(): string {
  const sessionId = `session-${Date.now()}`;
  currentSessionId = sessionId;
  
  const sessions = getAllSessions();
  const newSession: ConversationSession = {
    id: sessionId,
    startTime: new Date().toISOString(),
    messages: []
  };
  
  sessions.unshift(newSession);
  
  // Keep only recent sessions
  const trimmedSessions = sessions.slice(0, MAX_SESSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedSessions));
  
  return sessionId;
}

// Add message to current session
export function addMessage(
  role: 'user' | 'assistant',
  content: string,
  type: 'voice' | 'chat' = 'voice'
): void {
  if (!currentSessionId) {
    currentSessionId = startNewSession();
  }
  
  const sessions = getAllSessions();
  const sessionIndex = sessions.findIndex(s => s.id === currentSessionId);
  
  if (sessionIndex === -1) {
    console.error('Current session not found, creating new one');
    currentSessionId = startNewSession();
    return addMessage(role, content, type);
  }
  
  const message: ConversationMessage = {
    role,
    content,
    timestamp: new Date().toISOString(),
    type
  };
  
  sessions[sessionIndex].messages.push(message);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// End current session
export function endSession(summary?: string): void {
  if (!currentSessionId) return;
  
  const sessions = getAllSessions();
  const sessionIndex = sessions.findIndex(s => s.id === currentSessionId);
  
  if (sessionIndex !== -1) {
    sessions[sessionIndex].endTime = new Date().toISOString();
    if (summary) {
      sessions[sessionIndex].summary = summary;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }
  
  currentSessionId = null;
}

// Get current session
export function getCurrentSession(): ConversationSession | null {
  if (!currentSessionId) return null;
  const sessions = getAllSessions();
  return sessions.find(s => s.id === currentSessionId) || null;
}

// Get today's conversations
export function getTodaysSessions(): ConversationSession[] {
  const sessions = getAllSessions();
  const today = new Date().toDateString();
  
  return sessions.filter(session => {
    const sessionDate = new Date(session.startTime).toDateString();
    return sessionDate === today;
  });
}

// Get recent sessions (last N days)
export function getRecentSessions(days: number = 7): ConversationSession[] {
  const sessions = getAllSessions();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return sessions.filter(session => {
    return new Date(session.startTime) >= cutoffDate;
  });
}

// Generate summary of conversation
export function generateConversationSummary(session: ConversationSession): string {
  if (session.summary) return session.summary;
  
  const messageCount = session.messages.length;
  if (messageCount === 0) return "No messages in this session.";
  
  const userMessages = session.messages.filter(m => m.role === 'user').length;
  const assistantMessages = session.messages.filter(m => m.role === 'assistant').length;
  
  const duration = session.endTime 
    ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000)
    : 'ongoing';
  
  const firstUserMessage = session.messages.find(m => m.role === 'user')?.content || '';
  const preview = firstUserMessage.length > 100 
    ? firstUserMessage.substring(0, 100) + '...' 
    : firstUserMessage;
  
  return `${messageCount} messages (${userMessages} from user, ${assistantMessages} from Alfie) • Duration: ${duration}s\nStarted with: "${preview}"`;
}

// Export conversation history as text
export function exportConversationHistory(): string {
  const sessions = getAllSessions();
  
  let output = '# Alfie Conversation History\n\n';
  
  sessions.forEach((session, idx) => {
    const startDate = new Date(session.startTime).toLocaleString();
    output += `## Session ${sessions.length - idx} - ${startDate}\n\n`;
    
    session.messages.forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      output += `**[${time}] ${msg.role === 'user' ? 'You' : 'Alfie'}** (${msg.type}):\n${msg.content}\n\n`;
    });
    
    output += `---\n\n`;
  });
  
  return output;
}

// Clear all conversation history (use with caution)
export function clearAllConversations(): void {
  localStorage.removeItem(STORAGE_KEY);
  currentSessionId = null;
}

// ============================================================================
// SUPABASE INTEGRATION
// ============================================================================

/**
 * Upload a single conversation session to Supabase
 */
export async function uploadConversationToSupabase(session: ConversationSession): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured');
    return;
  }

  try {
    // Insert conversation
    const { data: conversationData, error: conversationError } = await supabase!
      .from('conversations')
      .insert({
        session_id: session.id,
        start_time: session.startTime,
        end_time: session.endTime || null,
        summary: session.summary || null,
        message_count: session.messages.length
      })
      .select()
      .single();

    if (conversationError) throw conversationError;

    // Insert messages
    const messages = session.messages.map(msg => ({
      conversation_id: conversationData.id,
      timestamp: msg.timestamp,
      role: msg.role,
      content: msg.content,
      type: msg.type
    }));

    if (messages.length > 0) {
      const { error: messagesError } = await supabase!
        .from('conversation_messages')
        .insert(messages);

      if (messagesError) throw messagesError;
    }

    await logSyncOperation('conversation', 'success', 1);
    console.log('✓ Conversation uploaded to Supabase');
  } catch (error) {
    console.error('Failed to upload conversation to Supabase:', error);
    await logSyncOperation('conversation', 'failed', 0, (error as any).message);
    throw error;
  }
}

/**
 * Upload all local conversations to Supabase
 */
export async function syncAllConversationsToSupabase(): Promise<number> {
  const sessions = getAllSessions();
  let successCount = 0;

  for (const session of sessions) {
    try {
      await uploadConversationToSupabase(session);
      successCount++;
    } catch (error) {
      console.warn(`Failed to sync session ${session.id}:`, error);
    }
  }

  console.log(`✓ Synced ${successCount} of ${sessions.length} conversations`);
  return successCount;
}

/**
 * Fetch conversations from Supabase
 */
export async function fetchConversationsFromSupabase(daysBack: number = 7): Promise<ConversationSession[]> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured');
    return [];
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Fetch conversations
    const { data: conversations, error: conversationsError } = await supabase!
      .from('conversations')
      .select('*')
      .gte('start_time', cutoffDate.toISOString())
      .order('start_time', { ascending: false });

    if (conversationsError) throw conversationsError;
    if (!conversations || conversations.length === 0) return [];

    // Fetch all messages for these conversations
    const conversationIds = conversations.map(c => c.id);
    const { data: messages, error: messagesError } = await supabase!
      .from('conversation_messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('timestamp', { ascending: true });

    if (messagesError) throw messagesError;

    // Reconstruct sessions
    const sessions: ConversationSession[] = conversations.map(conv => {
      const convMessages = (messages || [])
        .filter(m => m.conversation_id === conv.id)
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.timestamp,
          type: m.type as 'voice' | 'chat'
        }));

      return {
        id: conv.session_id,
        startTime: conv.start_time,
        endTime: conv.end_time || undefined,
        messages: convMessages,
        summary: conv.summary || undefined
      };
    });

    return sessions;
  } catch (error) {
    console.error('Failed to fetch conversations from Supabase:', error);
    return [];
  }
}

/**
 * Modified getRecentSessions with Supabase fallback
 * Returns merged results from local storage and Supabase
 */
const originalGetRecentSessions = getRecentSessions;

export async function getRecentSessionsWithFallback(daysBack: number = 7): Promise<ConversationSession[]> {
  // Get local sessions
  const localSessions = originalGetRecentSessions(daysBack);

  // Try to get from Supabase
  let supabaseSessions: ConversationSession[] = [];
  try {
    supabaseSessions = await fetchConversationsFromSupabase(daysBack);
  } catch (error) {
    console.warn('Failed to fetch from Supabase, using local only:', error);
  }

  // Merge and deduplicate (prefer Supabase if both have same session)
  const sessionMap = new Map<string, ConversationSession>();

  // Add local sessions first
  localSessions.forEach(s => sessionMap.set(s.id, s));

  // Override with Supabase sessions (they're likely fresher)
  supabaseSessions.forEach(s => sessionMap.set(s.id, s));

  // Sort by start time descending
  return Array.from(sessionMap.values()).sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
}

