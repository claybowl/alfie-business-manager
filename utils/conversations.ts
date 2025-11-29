// Conversation History Management for Alfie

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

