-- Alfie Notes System with Links and Attachments
-- Migration 002: Enhanced notes table with support for rich content

-- ============================================================================
-- NOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alfie_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Note content
  title text,
  content text NOT NULL,
  note_type text NOT NULL CHECK (note_type IN ('text', 'link', 'image', 'file')),
  
  -- For links
  url text,
  
  -- For images/files
  file_name text,
  file_url text,
  file_size integer,
  file_type text,
  
  -- Metadata
  tags text[],
  is_pinned boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  color text DEFAULT 'default',
  
  -- Order for manual sorting
  display_order integer DEFAULT 0
);

-- Indexes for efficient queries
CREATE INDEX idx_alfie_notes_created_at ON public.alfie_notes(created_at DESC);
CREATE INDEX idx_alfie_notes_updated_at ON public.alfie_notes(updated_at DESC);
CREATE INDEX idx_alfie_notes_note_type ON public.alfie_notes(note_type);
CREATE INDEX idx_alfie_notes_is_pinned ON public.alfie_notes(is_pinned);
CREATE INDEX idx_alfie_notes_is_archived ON public.alfie_notes(is_archived);
CREATE INDEX idx_alfie_notes_tags ON public.alfie_notes USING GIN(tags);

-- ============================================================================
-- STORAGE BUCKET FOR ATTACHMENTS
-- ============================================================================

-- Create storage bucket for note attachments (images, screenshots, files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('alfie-notes', 'alfie-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for anonymous users (single user setup)
CREATE POLICY "Allow all operations on alfie-notes bucket for anon users"
  ON storage.objects FOR ALL
  USING (bucket_id = 'alfie-notes')
  WITH CHECK (bucket_id = 'alfie-notes');

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on notes table
ALTER TABLE public.alfie_notes ENABLE ROW LEVEL SECURITY;

-- Create policy for anonymous access (single user with anon key)
CREATE POLICY "Allow all operations on alfie_notes for anon users"
  ON public.alfie_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL PRIVILEGES ON public.alfie_notes TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for alfie_notes table
CREATE TRIGGER update_alfie_notes_updated_at
  BEFORE UPDATE ON public.alfie_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for active notes (not archived)
CREATE OR REPLACE VIEW public.active_notes AS
SELECT *
FROM public.alfie_notes
WHERE is_archived = false
ORDER BY is_pinned DESC, display_order ASC, created_at DESC;

-- View for pinned notes only
CREATE OR REPLACE VIEW public.pinned_notes AS
SELECT *
FROM public.alfie_notes
WHERE is_pinned = true AND is_archived = false
ORDER BY display_order ASC, created_at DESC;

-- Grant view permissions
GRANT SELECT ON public.active_notes TO anon;
GRANT SELECT ON public.pinned_notes TO anon;

