-- Alfie Workstream Summaries Storage
-- Migration 003: Clean detailed workstream summaries for context priming

-- ============================================================================
-- WORKSTREAM SUMMARIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workstream_summaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now(),

  -- Date info
  summary_date date NOT NULL,
  day_label text NOT NULL, -- "today", "yesterday", "Monday (Dec 15)", etc.

  -- Structured summary sections
  core_tasks text, -- Core Tasks & Projects section
  key_discussions text, -- Key Discussions & Decisions section
  documents_reviewed text, -- Documents & Code Reviewed section
  next_steps text, -- Next Steps section

  -- Raw markdown for flexibility
  raw_summary text,

  -- Metadata
  source text DEFAULT 'pieces', -- pieces, manual, system, etc.
  is_manual boolean DEFAULT false, -- Was this manually created/edited?
  is_locked boolean DEFAULT false, -- Prevent auto-overwrite

  -- Searchability
  tags text[],
  keywords text
);

-- Indexes for efficient queries
CREATE INDEX idx_workstream_summaries_summary_date ON public.workstream_summaries(summary_date DESC);
CREATE INDEX idx_workstream_summaries_created_at ON public.workstream_summaries(created_at DESC);
CREATE INDEX idx_workstream_summaries_day_label ON public.workstream_summaries(day_label);
CREATE INDEX idx_workstream_summaries_source ON public.workstream_summaries(source);
CREATE INDEX idx_workstream_summaries_tags ON public.workstream_summaries USING GIN(tags);

-- ============================================================================
-- CONTEXT PRIMING HISTORY TABLE
-- ============================================================================

-- Track which summaries have been used in context priming to avoid duplication
CREATE TABLE IF NOT EXISTS public.context_priming_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now(),

  -- Reference to the summary that was primed
  workstream_summary_id uuid REFERENCES public.workstream_summaries(id) ON DELETE CASCADE,

  -- Which conversation/session used this
  session_id text,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,

  -- When it was used
  primed_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX idx_context_priming_history_summary_id ON public.context_priming_history(workstream_summary_id);
CREATE INDEX idx_context_priming_history_session_id ON public.context_priming_history(session_id);
CREATE INDEX idx_context_priming_history_primed_at ON public.context_priming_history(primed_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE public.workstream_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.context_priming_history ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (single user with anon key)
CREATE POLICY "Allow all operations on workstream_summaries for anon users"
  ON public.workstream_summaries
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on context_priming_history for anon users"
  ON public.context_priming_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL PRIVILEGES ON public.workstream_summaries TO anon;
GRANT ALL PRIVILEGES ON public.context_priming_history TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for recent summaries (last 14 days)
CREATE OR REPLACE VIEW public.recent_workstream_summaries AS
SELECT *
FROM public.workstream_summaries
WHERE summary_date >= CURRENT_DATE - INTERVAL '14 days'
ORDER BY summary_date DESC;

-- View for today's summary
CREATE OR REPLACE VIEW public.todays_workstream_summary AS
SELECT *
FROM public.workstream_summaries
WHERE summary_date = CURRENT_DATE
ORDER BY created_at DESC
LIMIT 1;

-- Grant view permissions
GRANT SELECT ON public.recent_workstream_summaries TO anon;
GRANT SELECT ON public.todays_workstream_summary TO anon;
