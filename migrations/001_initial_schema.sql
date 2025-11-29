-- Alfie Briefing & Conversations Storage Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- BRIEFING SNAPSHOTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.briefing_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now(),
  timestamp timestamp with time zone NOT NULL,
  system_status text,
  active_projects jsonb,
  recent_decisions jsonb,
  timeline jsonb,
  events jsonb,
  linear_issues jsonb,
  notion_pages jsonb,
  user_notes text,
  raw_context text,
  data_sources jsonb
);

-- Index for faster queries
CREATE INDEX idx_briefing_snapshots_created_at ON public.briefing_snapshots(created_at DESC);
CREATE INDEX idx_briefing_snapshots_timestamp ON public.briefing_snapshots(timestamp DESC);

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id text UNIQUE NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  summary text,
  message_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Index for faster queries
CREATE INDEX idx_conversations_session_id ON public.conversations(session_id);
CREATE INDEX idx_conversations_start_time ON public.conversations(start_time DESC);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);

-- ============================================================================
-- CONVERSATION MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  timestamp timestamp with time zone NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'voice')),
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_conversation_messages_conversation_id ON public.conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_timestamp ON public.conversation_messages(timestamp DESC);
CREATE INDEX idx_conversation_messages_created_at ON public.conversation_messages(created_at DESC);

-- ============================================================================
-- SYNC METADATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sync_metadata (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  last_sync_at timestamp with time zone NOT NULL,
  sync_type text NOT NULL CHECK (sync_type IN ('briefing', 'conversation')),
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  error_message text,
  records_synced integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Index for faster queries
CREATE INDEX idx_sync_metadata_sync_type ON public.sync_metadata(sync_type);
CREATE INDEX idx_sync_metadata_last_sync_at ON public.sync_metadata(last_sync_at DESC);
CREATE INDEX idx_sync_metadata_status ON public.sync_metadata(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Even for single user, we set RLS for security best practices

-- Enable RLS on all tables
ALTER TABLE public.briefing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (single user with anon key)
-- Allow insert, select, update, delete for anon users
CREATE POLICY "Allow all operations on briefing_snapshots for anon users"
  ON public.briefing_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on conversations for anon users"
  ON public.conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on conversation_messages for anon users"
  ON public.conversation_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on sync_metadata for anon users"
  ON public.sync_metadata
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL PRIVILEGES ON public.briefing_snapshots TO anon;
GRANT ALL PRIVILEGES ON public.conversations TO anon;
GRANT ALL PRIVILEGES ON public.conversation_messages TO anon;
GRANT ALL PRIVILEGES ON public.sync_metadata TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
