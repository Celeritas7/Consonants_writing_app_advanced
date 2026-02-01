"""
Burmese Data Import Script v2
==============================
Follows Step A/B/C import logic:
  A) Extract anchors from "anchor header rows"
  B) Extract words from all word rows
  C) Create word-anchor relationships

Usage:
1. Edit the CONFIGURATION section below
2. Run: python burmese_data_import_v2.py
3. Import generated SQL file into Supabase

Requirements:
    pip install pandas openpyxl
"""

import pandas as pd
import re
import os
from collections import defaultdict

# Resolve paths relative to this script (so it works no matter where you run it from)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def resolve_path(p: str) -> str:
    """Return an absolute path. Relative paths are treated as relative to this .py file."""
    if not p:
        return p
    return p if os.path.isabs(p) else os.path.join(BASE_DIR, p)

# How many top rows to skip after reading each sheet (useful when Excel has title/header rows)
SKIP_TOP_ROWS = 2

# ============================================================
# CONFIGURATION - EDIT THESE PATHS
# ============================================================

# Input file paths (use raw strings r"..." for Windows paths)
INPUT_FILES = [
    {
        "path": r"KG_book_Burmese.xlsx",
        "sheet": "1_Raw_data",
        "type": "modified",  # or "simple"
        "source_name": "kg_book"
    },
    {
        "path": r"Burmese_Words_R002.xlsx",
        "sheet": "Final_Selective_N2_kanji",
        "type": "simple",
        "source_name": "words"
    },
    {
        "path": r"Recipies_R002.xlsx",
        "sheet": "Final_Selective_N2_kanji",
        "type": "simple",
        "source_name": "recipes"
    },
]

# Output directory
OUTPUT_DIR = os.path.join(BASE_DIR, "supabase_output")

# Minimum anchor frequency (anchors appearing in fewer words will be skipped)
MIN_ANCHOR_FREQUENCY = 1

# ============================================================
# BURMESE CHARACTER SETS
# ============================================================

BURMESE_CONSONANTS = [
    'က', 'ခ', 'ဂ', 'ဃ', 'င',
    'စ', 'ဆ', 'ဇ', 'ဈ', 'ည',
    'ဋ', 'ဌ', 'ဍ', 'ဎ', 'ဏ',
    'တ', 'ထ', 'ဒ', 'ဓ', 'န',
    'ပ', 'ဖ', 'ဗ', 'ဘ', 'မ',
    'ယ', 'ရ', 'လ', 'ဝ', 'သ',
    'ဟ', 'ဠ', 'အ'
]

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def normalize_text(text):
    """Normalize Burmese text - trim, remove weird spaces"""
    if pd.isna(text) or text is None:
        return None
    text = str(text).strip()
    # Remove zero-width characters and normalize spaces
    text = re.sub(r'[\u200b\u200c\u200d\ufeff]', '', text)
    text = re.sub(r'\s+', ' ', text)
    if text == '' or text.lower() == 'nan':
        return None
    return text

def get_first_consonant(word):
    """Extract the first Burmese consonant from a word"""
    if not word:
        return None
    for char in word:
        if char in BURMESE_CONSONANTS:
            return char
    return None

def escape_sql(text):
    """Escape text for SQL insertion"""
    if text is None:
        return None
    return str(text).replace("'", "''")

def sql_literal_or_null(text):
    """Return a SQL literal (single-quoted + escaped) or NULL."""
    if text is None:
        return "NULL"
    return f"'{escape_sql(text)}'"

def sql_consonant_id_subquery_or_null(consonant_char):
    """Return a consonant subquery or NULL if unknown."""
    if not consonant_char:
        return "NULL"
    c = escape_sql(consonant_char)
    return f"(SELECT id FROM burmese_consonants WHERE burmese_char = '{c}' LIMIT 1)"

def extract_group_index(group_no):
    """Extract numeric index from group_no like 'သ_1' -> 1"""
    if not group_no:
        return None
    match = re.search(r'(\d+)', str(group_no))
    return int(match.group(1)) if match else None

# ============================================================
# COLUMN MAPPING (handles different Excel formats)
# ============================================================

COLUMN_MAPS = {
    "modified": {
        # For files like KG_book with detailed structure
        "category": 3,      # Categorie
        "group_no": 6,      # Categorie_count
        "raw": 7,           # Raw (the actual content)
        "word": 9,          # Burmese_word
        "devanagari": 13,   # Marathi
        "meaning": 14,      # Meaning
        "hint": 11,         # Hint
        "sentence": 12,     # Sentence
    },
    "simple": {
        # For files like Burmese_Words with simpler structure
        "category": 3,      # Title
        "word": 5,          # Kanji (Burmese word)
        "devanagari": 7,    # Hiragana (Devanagari)
        "meaning": 8,       # Meaning
    }
}

# ============================================================
# STEP A: Extract Anchors
# ============================================================

def extract_anchors(df, file_config, col_map):
    """
    Extract anchors from 'anchor header rows'.
    An anchor header is a row where:
    - Group/Category is NOT NULL
    - The row represents a grouping header, not a word entry
    """
    anchors = {}
    source = file_config["source_name"]
    
    print(f"  Step A: Extracting anchors...")
    
    current_category = None
    current_group_no = None
    
    for idx, row in df.iterrows():
        # Get category/group info
        category = normalize_text(row.iloc[col_map.get("category", 3)] if col_map.get("category") else None)
        group_no = normalize_text(row.iloc[col_map.get("group_no", 6)] if col_map.get("group_no") else None)
        
        # Get the anchor text (from 'raw' or 'word' column)
        if "raw" in col_map:
            anchor_text = normalize_text(row.iloc[col_map["raw"]])
        else:
            anchor_text = normalize_text(row.iloc[col_map["word"]])
        
        meaning = normalize_text(row.iloc[col_map["meaning"]] if col_map.get("meaning") else None)
        
        # Also read the dedicated word column (if present) to avoid mis-classifying word rows as anchor headers
        word_text = None
        if col_map.get("word") is not None:
            word_text = normalize_text(row.iloc[col_map["word"]])
        
        # Track current category
        if category:
            current_category = category
            current_group_no = group_no or category
        
        # Identify anchor header rows
        # Usually: category is set AND this is the first row of a group
        # OR: the row has a category value (indicating group change)
        # Identify anchor header rows
        # Heuristic: if the dedicated word column is filled AND differs from the anchor_text,
        # this is likely a word row, not an anchor header.
        if category and anchor_text and (not word_text or word_text == anchor_text):
            base_consonant = get_first_consonant(anchor_text)
            
            # Create anchor key for deduplication
            anchor_key = anchor_text
            
            if anchor_key not in anchors:
                anchors[anchor_key] = {
                    "anchor_text": anchor_text,
                    "base_consonant": base_consonant,
                    "group_no": current_group_no,
                    "meaning": meaning,
                    "category": current_category,
                    "source": source,
                    "word_count": 0,
                    "is_curated": True,  # From Excel = curated
                }
    
    print(f"    Found {len(anchors)} anchors")
    return anchors

# ============================================================
# STEP B: Extract Words
# ============================================================

def extract_words(df, file_config, col_map):
    """
    Extract all word rows (non-header rows with valid word text).
    """
    words = {}
    source = file_config["source_name"]
    
    print(f"  Step B: Extracting words...")
    
    current_category = None
    current_anchor = None
    
    for idx, row in df.iterrows():
        # Track category/anchor context
        category = normalize_text(row.iloc[col_map.get("category", 3)] if col_map.get("category") else None)
        
        if category:
            current_category = category
            # The category row often IS the anchor
            if "raw" in col_map:
                current_anchor = normalize_text(row.iloc[col_map["raw"]])
            else:
                current_anchor = normalize_text(row.iloc[col_map["word"]])
        
        # Get word text
        word_text = normalize_text(row.iloc[col_map["word"]])
        
        if not word_text:
            continue
        
        # Skip if it's just a category header (all caps English, etc.)
        if word_text.isupper() and word_text.isascii():
            continue
        
        # Get other fields
        devanagari = normalize_text(row.iloc[col_map["devanagari"]] if col_map.get("devanagari") else None)
        meaning = normalize_text(row.iloc[col_map["meaning"]] if col_map.get("meaning") else None)
        hint = normalize_text(row.iloc[col_map["hint"]] if col_map.get("hint") else None)
        sentence = normalize_text(row.iloc[col_map["sentence"]] if col_map.get("sentence") else None)
        
        # Dedupe by word_text
        word_key = word_text
        
        if word_key not in words:
            words[word_key] = {
                "word_text": word_text,
                "devanagari": devanagari,
                "meaning": meaning,
                "hint": hint,
                "sentence": sentence,
                "category": current_category,
                "primary_anchor": current_anchor,
                "source": source,
                "source_row": idx,
                "first_consonant": get_first_consonant(word_text),
            }
        else:
            # Update if this row has more info
            if meaning and not words[word_key]["meaning"]:
                words[word_key]["meaning"] = meaning
            if devanagari and not words[word_key]["devanagari"]:
                words[word_key]["devanagari"] = devanagari
    
    print(f"    Found {len(words)} unique words")
    return words

# ============================================================
# STEP C: Create Word-Anchor Relationships
# ============================================================

def create_word_anchor_links(words, anchors):
    """
    Create relationships between words and anchors.
    Uses the Excel-provided grouping (primary_anchor) first.
    """
    links = []
    
    print(f"  Step C: Creating word-anchor links...")
    
    # Update anchor word counts
    anchor_word_counts = defaultdict(int)
    
    for word_key, word_data in words.items():
        primary_anchor = word_data.get("primary_anchor")
        
        if primary_anchor and primary_anchor in anchors:
            links.append({
                "word_text": word_data["word_text"],
                "anchor_text": primary_anchor,
                "is_primary": True,
                "match_type": "manual",  # From Excel grouping
            })
            anchor_word_counts[primary_anchor] += 1
    
    # Update anchor word counts
    for anchor_text, count in anchor_word_counts.items():
        if anchor_text in anchors:
            anchors[anchor_text]["word_count"] = count
    
    print(f"    Created {len(links)} word-anchor links")
    return links

# ============================================================
# SQL GENERATION
# ============================================================

def generate_sql(anchors, words, links, output_file):
    """Generate SQL INSERT statements"""
    
    print(f"\nGenerating SQL: {output_file}")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- ============================================================\n")
        f.write("-- BURMESE DATA IMPORT (Generated by burmese_data_import_v2.py)\n")
        f.write("-- Run AFTER burmese_schema_R001.sql and burmese_schema_migration_R001.sql\n")
        f.write("-- ============================================================\n\n")
        
        # ==================== CATEGORIES ====================
        f.write("-- ============ CATEGORIES ============\n")
        categories = set()
        for w in words.values():
            if w.get("category"):
                categories.add((w["category"], w["source"]))
        
        for cat, source in sorted(categories):
            cat_esc = escape_sql(cat)
            f.write(f"INSERT INTO burmese_categories (name, source) ")
            f.write(f"VALUES ('{cat_esc}', '{source}') ON CONFLICT DO NOTHING;\n")
        
        f.write(f"\n-- Total categories: {len(categories)}\n\n")
        
        # ==================== ANCHORS ====================
        f.write("-- ============ ANCHORS ============\n")
        
        for anchor_text, anchor_data in anchors.items():
            if anchor_data["word_count"] < MIN_ANCHOR_FREQUENCY:
                continue
                
            anchor_esc = escape_sql(anchor_data["anchor_text"])
            meaning_esc = escape_sql(anchor_data.get("meaning"))
            group_no_esc = escape_sql(anchor_data.get("group_no"))
            base_consonant = anchor_data.get("base_consonant")
            consonant_id_sql = sql_consonant_id_subquery_or_null(base_consonant)
            group_index = extract_group_index(anchor_data.get("group_no"))
            word_count = anchor_data.get("word_count", 0)
            
            f.write(f"""INSERT INTO burmese_anchor_words (burmese_word, meaning, group_no, group_index, word_count, is_curated, is_auto_generated, consonant_id)
SELECT '{anchor_esc}', 
    {f"'{meaning_esc}'" if meaning_esc else 'NULL'},
    {f"'{group_no_esc}'" if group_no_esc else 'NULL'},
    {group_index if group_index else 'NULL'},
    {word_count},
    TRUE,
    FALSE,
    {sql_consonant_id_subquery_or_null(base_consonant)}
ON CONFLICT (burmese_word) DO UPDATE SET 
    meaning = COALESCE(EXCLUDED.meaning, burmese_anchor_words.meaning),
    group_no = COALESCE(EXCLUDED.group_no, burmese_anchor_words.group_no),
    word_count = EXCLUDED.word_count,
    is_curated = TRUE;
""")
        
        anchor_count = sum(1 for a in anchors.values() if a["word_count"] >= MIN_ANCHOR_FREQUENCY)
        f.write(f"\n-- Total anchors: {anchor_count}\n\n")
        
        # ==================== WORDS ====================
        f.write("-- ============ WORDS ============\n")
        
        for word_text, word_data in words.items():
            word_esc = escape_sql(word_data["word_text"])
            devanagari_esc = escape_sql(word_data.get("devanagari"))
            meaning_esc = escape_sql(word_data.get("meaning"))
            hint_esc = escape_sql(word_data.get("hint"))
            sentence_esc = escape_sql(word_data.get("sentence"))
            category_raw = word_data.get("category")
            category = escape_sql(category_raw)
            source = word_data.get("source", "unknown")
            first_consonant = word_data.get("first_consonant")
            word_length = len(word_data["word_text"])
            category_id_sql = f"(SELECT id FROM burmese_categories WHERE name = {sql_literal_or_null(category_raw)} LIMIT 1)" if category_raw else "NULL"
            first_consonant_id_sql = sql_consonant_id_subquery_or_null(first_consonant)
            
            f.write(f"""INSERT INTO burmese_words (burmese_word, devanagari, english_meaning, hint, sentence, source, word_length, category_id, first_consonant_id)
SELECT '{word_esc}',
    {f"'{devanagari_esc}'" if devanagari_esc else 'NULL'},
    {f"'{meaning_esc}'" if meaning_esc else 'NULL'},
    {f"'{hint_esc}'" if hint_esc else 'NULL'},
    {f"'{sentence_esc}'" if sentence_esc else 'NULL'},
    '{source}',
    {word_length},
    {'(SELECT id FROM burmese_categories WHERE name = ' + sql_literal_or_null(word_data.get('category')) + ' LIMIT 1)' if word_data.get('category') else 'NULL'},
    {sql_consonant_id_subquery_or_null(first_consonant)}
ON CONFLICT DO NOTHING;
""")
        
        f.write(f"\n-- Total words: {len(words)}\n\n")
        
        # ==================== WORD-ANCHOR LINKS ====================
        f.write("-- ============ WORD-ANCHOR LINKS ============\n")
        
        for link in links:
            word_esc = escape_sql(link["word_text"])
            anchor_esc = escape_sql(link["anchor_text"])
            is_primary = "TRUE" if link.get("is_primary") else "FALSE"
            match_type = link.get("match_type", "manual")
            
            f.write(f"""INSERT INTO burmese_word_anchors (word_id, anchor_id, is_primary, match_type)
SELECT w.id, a.id, {is_primary}, '{match_type}'
FROM burmese_words w, burmese_anchor_words a
WHERE w.burmese_word = '{word_esc}' AND a.burmese_word = '{anchor_esc}'
ON CONFLICT (word_id, anchor_id) DO UPDATE SET is_primary = EXCLUDED.is_primary;
""")
        
        f.write(f"\n-- Total links: {len(links)}\n\n")
        
        # ==================== UPDATE FUNCTIONS ====================
        f.write("-- ============ UPDATE CONSONANT REFERENCES ============\n")
        f.write("SELECT update_word_consonants();\n\n")
        
        f.write("-- ============ UPDATE CATEGORY COUNTS ============\n")
        f.write("""UPDATE burmese_categories c
SET word_count = (SELECT COUNT(*) FROM burmese_words w WHERE w.category_id = c.id);
""")
        
        f.write("\n-- ============ IMPORT COMPLETE ============\n")
    
    print(f"  Generated: {output_file}")
    return anchor_count, len(words), len(links)

# ============================================================
# MAIN
# ============================================================

def main():
    print("="*60)
    print("BURMESE DATA IMPORT v2 (Step A/B/C)")
    print("="*60)
    
    # Create output directory
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Created output directory: {OUTPUT_DIR}")
    
    all_anchors = {}
    all_words = {}
    all_links = []
    
    # Process each input file
    for file_config in INPUT_FILES:
        filepath = resolve_path(file_config["path"])
        
        if not os.path.exists(filepath):
            print(f"\n⚠ File not found: {filepath}")
            continue
        
        print(f"\n📄 Processing: {filepath}")
        
        try:
            df = pd.read_excel(filepath, sheet_name=file_config["sheet"], header=None)
            if SKIP_TOP_ROWS:
                df = df.iloc[SKIP_TOP_ROWS:]  # Skip top rows (Excel title/header rows)
            
            col_map = COLUMN_MAPS[file_config["type"]]
            
            # Step A: Extract anchors
            anchors = extract_anchors(df, file_config, col_map)
            # Merge anchors without blindly overwriting (keep existing; fill missing fields)
            for k, v in anchors.items():
                if k not in all_anchors:
                    all_anchors[k] = v
                else:
                    for fld in ("meaning", "group_no", "category", "base_consonant"):
                        if not all_anchors[k].get(fld) and v.get(fld):
                            all_anchors[k][fld] = v.get(fld)
                    # Preserve curated flag if any source says curated
                    all_anchors[k]["is_curated"] = bool(all_anchors[k].get("is_curated") or v.get("is_curated"))
            
            # Step B: Extract words
            words = extract_words(df, file_config, col_map)
            all_words.update(words)
            
        except Exception as e:
            print(f"  ❌ Error processing file: {e}")
            continue
    
    if not all_words:
        print("\n❌ No data extracted! Check your file paths and column mappings.")
        return
    
    # Step C: Create links
    all_links = create_word_anchor_links(all_words, all_anchors)
    
    # Generate SQL
    sql_file = os.path.join(OUTPUT_DIR, "burmese_data_import_v2.sql")
    anchor_count, word_count, link_count = generate_sql(all_anchors, all_words, all_links, sql_file)
    
    # Summary
    print("\n" + "="*60)
    print("✅ IMPORT COMPLETE")
    print("="*60)
    print(f"""
Summary:
  - Anchors: {anchor_count}
  - Words: {word_count}
  - Links: {link_count}

Output: {sql_file}

Next Steps:
1. Run burmese_schema_migration_R001.sql in Supabase (if not done)
2. Run {sql_file} in Supabase SQL Editor
3. Verify data with: SELECT * FROM burmese_v_words_by_anchor LIMIT 100;
""")

if __name__ == "__main__":
    main()
