-- =====================================================
-- Card Tab - Supabase BYOS setup
-- Uses project-level API key access (no Supabase Auth required)
-- Recommended: dedicate one project to Card Tab
-- =====================================================

CREATE TABLE IF NOT EXISTS card_tab_data (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'card-tab',
  theme_id TEXT NOT NULL DEFAULT 'default',
  theme_name TEXT DEFAULT '',
  theme_type TEXT DEFAULT 'default',
  bg_image_url TEXT,
  bg_image_path TEXT,
  bg_opacity INTEGER DEFAULT 30,
  is_active INTEGER DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, theme_id)
);

ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS theme_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS theme_name TEXT DEFAULT '';
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS theme_type TEXT DEFAULT 'default';
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS bg_image_url TEXT;
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS bg_image_path TEXT;
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS bg_opacity INTEGER DEFAULT 30;
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 0;
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE card_tab_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE card_tab_data ALTER COLUMN user_id SET DEFAULT 'card-tab';
ALTER TABLE card_tab_data ALTER COLUMN theme_id SET DEFAULT 'default';
ALTER TABLE card_tab_data ALTER COLUMN theme_name SET DEFAULT '';
ALTER TABLE card_tab_data ALTER COLUMN theme_type SET DEFAULT 'default';
ALTER TABLE card_tab_data ALTER COLUMN bg_opacity SET DEFAULT 30;
ALTER TABLE card_tab_data ALTER COLUMN is_active SET DEFAULT 0;
ALTER TABLE card_tab_data ALTER COLUMN data SET DEFAULT '{}'::jsonb;
ALTER TABLE card_tab_data ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE card_tab_data ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE card_tab_data
SET user_id = COALESCE(NULLIF(user_id, ''), 'card-tab'),
    theme_id = COALESCE(NULLIF(theme_id, ''), 'default');

ALTER TABLE card_tab_data DROP CONSTRAINT IF EXISTS card_tab_data_user_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'card_tab_data_user_id_theme_id_key'
  ) THEN
    ALTER TABLE card_tab_data
    ADD CONSTRAINT card_tab_data_user_id_theme_id_key UNIQUE (user_id, theme_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_card_tab_data_user_id ON card_tab_data(user_id);
CREATE INDEX IF NOT EXISTS idx_card_tab_data_theme_id ON card_tab_data(theme_id);
CREATE INDEX IF NOT EXISTS idx_card_tab_data_updated_at ON card_tab_data(updated_at);

ALTER TABLE card_tab_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own card tab data" ON card_tab_data;
DROP POLICY IF EXISTS "Users can insert own card tab data" ON card_tab_data;
DROP POLICY IF EXISTS "Users can update own card tab data" ON card_tab_data;
DROP POLICY IF EXISTS "Users can delete own card tab data" ON card_tab_data;
DROP POLICY IF EXISTS "Card Tab can read data" ON card_tab_data;
DROP POLICY IF EXISTS "Card Tab can insert data" ON card_tab_data;
DROP POLICY IF EXISTS "Card Tab can update data" ON card_tab_data;
DROP POLICY IF EXISTS "Card Tab can delete data" ON card_tab_data;

CREATE POLICY "Card Tab can read data"
ON card_tab_data
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Card Tab can insert data"
ON card_tab_data
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Card Tab can update data"
ON card_tab_data
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Card Tab can delete data"
ON card_tab_data
FOR DELETE
TO anon, authenticated
USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own background objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own background objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own background objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own background objects" ON storage.objects;
DROP POLICY IF EXISTS "Card Tab can read background objects" ON storage.objects;
DROP POLICY IF EXISTS "Card Tab can upload background objects" ON storage.objects;
DROP POLICY IF EXISTS "Card Tab can update background objects" ON storage.objects;
DROP POLICY IF EXISTS "Card Tab can delete background objects" ON storage.objects;

CREATE POLICY "Card Tab can read background objects"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'backgrounds'
);

CREATE POLICY "Card Tab can upload background objects"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'backgrounds'
);

CREATE POLICY "Card Tab can update background objects"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (
  bucket_id = 'backgrounds'
)
WITH CHECK (
  bucket_id = 'backgrounds'
);

CREATE POLICY "Card Tab can delete background objects"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (
  bucket_id = 'backgrounds'
);

SELECT 'Card Tab Supabase BYOS setup complete' AS status;
