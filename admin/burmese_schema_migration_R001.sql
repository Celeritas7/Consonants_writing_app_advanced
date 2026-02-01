-- ============================================================
-- BURMESE SCHEMA MIGRATION R001
-- Run this AFTER the initial burmese_schema_R001.sql
-- ============================================================

-- ============================================================
-- 1. UPDATE burmese_anchor_words TABLE
-- ============================================================

-- Add group_no column (TEXT to handle values like "သ_1")
ALTER TABLE burmese_anchor_words 
ADD COLUMN IF NOT EXISTS group_no TEXT;

-- Add group_index for numeric sorting (extracted from group_no)
ALTER TABLE burmese_anchor_words 
ADD COLUMN IF NOT EXISTS group_index INT;

-- Add is_curated flag (to distinguish manual vs auto-generated)
ALTER TABLE burmese_anchor_words 
ADD COLUMN IF NOT EXISTS is_curated BOOLEAN DEFAULT FALSE;

-- Create index for group lookups
CREATE INDEX IF NOT EXISTS idx_anchor_group_no ON burmese_anchor_words(group_no);


-- ============================================================
-- 2. UPDATE burmese_words TABLE
-- ============================================================

-- Add hint column
ALTER TABLE burmese_words 
ADD COLUMN IF NOT EXISTS hint TEXT;

-- Add sentence column
ALTER TABLE burmese_words 
ADD COLUMN IF NOT EXISTS sentence TEXT;

-- Add supporting words
ALTER TABLE burmese_words 
ADD COLUMN IF NOT EXISTS supporting_word_1 VARCHAR(200);

ALTER TABLE burmese_words 
ADD COLUMN IF NOT EXISTS supporting_word_2 VARCHAR(200);


-- ============================================================
-- 3. UPDATE burmese_word_anchors TABLE
-- ============================================================

-- Add match_type for future use
ALTER TABLE burmese_word_anchors 
ADD COLUMN IF NOT EXISTS match_type VARCHAR(20) DEFAULT 'contains';
-- Values: 'contains', 'prefix', 'suffix', 'exact', 'manual'

-- Add is_primary flag (the main anchor for this word, from Excel grouping)
ALTER TABLE burmese_word_anchors 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;


-- ============================================================
-- 4. RENAME burmese_user_progress TO burmese_user_state
-- (State table - current mastery snapshot)
-- ============================================================

-- First, check if old table exists and rename
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'burmese_user_progress') THEN
        ALTER TABLE burmese_user_progress RENAME TO burmese_user_state;
    END IF;
END $$;

-- Update the state table structure
ALTER TABLE burmese_user_state 
ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMP WITH TIME ZONE;

-- Remove JSONB history column if it exists (we'll use events table instead)
-- Keep it for now as backup, but mark deprecated
COMMENT ON COLUMN burmese_user_state.attempt_history IS 'DEPRECATED: Use burmese_progress_events instead';


-- ============================================================
-- 5. CREATE burmese_progress_events TABLE (Event Log)
-- ============================================================

CREATE TABLE IF NOT EXISTS burmese_progress_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(100) NOT NULL,
    item_type VARCHAR(20) NOT NULL, -- 'consonant', 'anchor', 'word', 'combo'
    item_id INT NOT NULL,
    event_type VARCHAR(20) NOT NULL, -- 'correct', 'incorrect', 'skip', 'hint_used'
    delta INT DEFAULT 0, -- +1 for correct, -1 for incorrect, etc.
    metadata JSONB DEFAULT '{}', -- Additional context (quiz_mode, time_spent, etc.)
    device_id VARCHAR(100), -- For cross-device sync
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_progress_events_user ON burmese_progress_events(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_events_item ON burmese_progress_events(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_progress_events_created ON burmese_progress_events(created_at);
CREATE INDEX IF NOT EXISTS idx_progress_events_user_item ON burmese_progress_events(user_id, item_type, item_id);

-- Enable RLS
ALTER TABLE burmese_progress_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust for your auth setup)
CREATE POLICY IF NOT EXISTS progress_events_select ON burmese_progress_events
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS progress_events_insert ON burmese_progress_events
    FOR INSERT WITH CHECK (true);


-- ============================================================
-- 6. CREATE FUNCTION: Aggregate events to state
-- ============================================================

CREATE OR REPLACE FUNCTION burmese_fn_sync_user_state(p_user_id VARCHAR(100))
RETURNS INT AS $$
DECLARE
    synced_count INT := 0;
BEGIN
    -- Upsert state from events
    INSERT INTO burmese_user_state (user_id, item_type, item_id, correct_count, incorrect_count, mastery_level, last_practiced, updated_at)
    SELECT 
        user_id,
        item_type,
        item_id,
        COUNT(*) FILTER (WHERE event_type = 'correct') as correct_count,
        COUNT(*) FILTER (WHERE event_type = 'incorrect') as incorrect_count,
        LEAST(5, GREATEST(0, 
            (COUNT(*) FILTER (WHERE event_type = 'correct') - 
             COUNT(*) FILTER (WHERE event_type = 'incorrect')) / 3
        ))::INT as mastery_level,
        MAX(created_at) as last_practiced,
        NOW() as updated_at
    FROM burmese_progress_events
    WHERE user_id = p_user_id
    GROUP BY user_id, item_type, item_id
    ON CONFLICT (user_id, item_type, item_id) 
    DO UPDATE SET
        correct_count = EXCLUDED.correct_count,
        incorrect_count = EXCLUDED.incorrect_count,
        mastery_level = EXCLUDED.mastery_level,
        last_practiced = EXCLUDED.last_practiced,
        updated_at = NOW();
    
    GET DIAGNOSTICS synced_count = ROW_COUNT;
    RETURN synced_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 7. CREATE VIEW: Anchors with word counts
-- ============================================================

CREATE OR REPLACE VIEW burmese_v_anchor_stats AS
SELECT 
    a.id,
    a.burmese_word as anchor_text,
    a.devanagari,
    a.meaning,
    a.group_no,
    a.group_index,
    c.burmese_char as base_consonant,
    c.devanagari as consonant_devanagari,
    a.is_curated,
    a.is_auto_generated,
    COUNT(DISTINCT wa.word_id) as linked_word_count,
    a.word_count as frequency_in_corpus
FROM burmese_anchor_words a
LEFT JOIN burmese_consonants c ON a.consonant_id = c.id
LEFT JOIN burmese_word_anchors wa ON a.id = wa.anchor_id
GROUP BY a.id, c.burmese_char, c.devanagari
ORDER BY a.group_no, a.frequency_rank;


-- ============================================================
-- 8. CREATE VIEW: Words grouped by primary anchor
-- ============================================================

CREATE OR REPLACE VIEW burmese_v_words_by_anchor AS
SELECT 
    a.id as anchor_id,
    a.burmese_word as anchor_text,
    a.group_no,
    c.burmese_char as base_consonant,
    w.id as word_id,
    w.burmese_word as word_text,
    w.devanagari as word_devanagari,
    w.english_meaning,
    w.hint,
    w.sentence,
    wa.is_primary,
    wa.match_type
FROM burmese_anchor_words a
LEFT JOIN burmese_consonants c ON a.consonant_id = c.id
LEFT JOIN burmese_word_anchors wa ON a.id = wa.anchor_id
LEFT JOIN burmese_words w ON wa.word_id = w.id
ORDER BY a.group_no, a.burmese_word, w.burmese_word;


-- ============================================================
-- 9. CREATE VIEW: User progress summary
-- ============================================================

CREATE OR REPLACE VIEW burmese_v_user_progress_summary AS
SELECT 
    user_id,
    item_type,
    COUNT(*) as total_items_practiced,
    SUM(CASE WHEN mastery_level >= 4 THEN 1 ELSE 0 END) as mastered_count,
    SUM(CASE WHEN mastery_level BETWEEN 2 AND 3 THEN 1 ELSE 0 END) as learning_count,
    SUM(CASE WHEN mastery_level <= 1 THEN 1 ELSE 0 END) as new_count,
    ROUND(AVG(mastery_level)::numeric, 2) as avg_mastery,
    MAX(last_practiced) as last_active
FROM burmese_user_state
GROUP BY user_id, item_type;


-- ============================================================
-- 10. HELPER FUNCTION: Extract group_index from group_no
-- ============================================================

CREATE OR REPLACE FUNCTION burmese_fn_extract_group_index(group_no_text TEXT)
RETURNS INT AS $$
BEGIN
    -- Extract numeric part from strings like "သ_1", "က_12", "1", "12"
    RETURN (regexp_replace(group_no_text, '[^0-9]', '', 'g'))::INT;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================
-- 11. UPDATE existing anchors with group_index
-- ============================================================

UPDATE burmese_anchor_words 
SET group_index = burmese_fn_extract_group_index(group_no)
WHERE group_no IS NOT NULL AND group_index IS NULL;


-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

/*
SUMMARY OF CHANGES:

Tables Modified:
- burmese_anchor_words: Added group_no, group_index, is_curated
- burmese_words: Added hint, sentence, supporting_word_1, supporting_word_2
- burmese_word_anchors: Added match_type, is_primary
- burmese_user_progress → renamed to burmese_user_state

Tables Created:
- burmese_progress_events (event log for progress tracking)

Views Created:
- burmese_v_anchor_stats
- burmese_v_words_by_anchor  
- burmese_v_user_progress_summary

Functions Created:
- burmese_fn_sync_user_state(user_id)
- burmese_fn_extract_group_index(group_no)

Next Steps:
1. Run this migration in Supabase SQL Editor
2. Use updated Python import script to import Excel data
*/
