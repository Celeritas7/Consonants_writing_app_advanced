"""
Burmese Data Import Script
===========================
This script extracts data from Excel files and prepares it for Supabase import.

Usage:
1. Place your Excel files in the same directory
2. Run: python burmese_data_import.py
3. It will generate CSV files and SQL INSERT statements

Requirements:
    pip install pandas openpyxl supabase
"""

import pandas as pd
import json
from collections import Counter, defaultdict
import os

# Burmese consonants
BURMESE_CONSONANTS = [
    'က', 'ခ', 'ဂ', 'ဃ', 'င',
    'စ', 'ဆ', 'ဇ', 'ဈ', 'ည',
    'ဋ', 'ဌ', 'ဍ', 'ဎ', 'ဏ',
    'တ', 'ထ', 'ဒ', 'ဓ', 'န',
    'ပ', 'ဖ', 'ဗ', 'ဘ', 'မ',
    'ယ', 'ရ', 'လ', 'ဝ', 'သ',
    'ဟ', 'ဠ', 'အ'
]

def get_first_consonant(word):
    """Extract the first Burmese consonant from a word"""
    if not word or not isinstance(word, str):
        return None
    for char in word:
        if char in BURMESE_CONSONANTS:
            return char
    return None

def clean_string(s):
    """Clean a string for SQL insertion"""
    if pd.isna(s) or s is None:
        return None
    s = str(s).strip()
    if s == '' or s.lower() == 'nan':
        return None
    # Escape single quotes for SQL
    return s.replace("'", "''")

def extract_kg_book(filepath):
    """Extract data from KG_book_Burmese.xlsx"""
    print(f"Processing: {filepath}")
    
    # Main data
    df = pd.read_excel(filepath, sheet_name="1_Raw_data", header=None)
    df_clean = df.iloc[2:, [3, 9, 13, 14]].copy()
    df_clean.columns = ['category', 'burmese', 'devanagari', 'meaning']
    df_clean['source'] = 'kg_book'
    
    # Numbers data
    try:
        df_num = pd.read_excel(filepath, sheet_name="1_Raw_data_numbers", header=None)
        df_num_clean = df_num.iloc[2:, [3, 13, 13, 14]].copy()  # Note: using Burmese_word column
        df_num_clean.columns = ['category', 'burmese', 'devanagari', 'meaning']
        df_num_clean['source'] = 'kg_book'
        df_clean = pd.concat([df_clean, df_num_clean], ignore_index=True)
    except Exception as e:
        print(f"  Note: Could not load numbers sheet: {e}")
    
    # Clean data
    df_clean = df_clean.dropna(subset=['burmese'])
    df_clean = df_clean[df_clean['burmese'].astype(str).str.strip().str.len() > 0]
    df_clean['burmese'] = df_clean['burmese'].astype(str).str.strip()
    df_clean['category'] = df_clean['category'].ffill()
    
    print(f"  Extracted {len(df_clean)} words")
    return df_clean

def extract_burmese_words(filepath):
    """Extract data from Burmese_Words_R002.xlsx"""
    print(f"Processing: {filepath}")
    
    df = pd.read_excel(filepath, sheet_name="Final_Selective_N2_kanji", header=None)
    df_clean = df.iloc[2:, [3, 5, 7, 8]].copy()
    df_clean.columns = ['category', 'burmese', 'devanagari', 'meaning']
    df_clean['source'] = 'words'
    
    # Clean data
    df_clean = df_clean.dropna(subset=['burmese'])
    df_clean = df_clean[df_clean['burmese'].astype(str).str.strip().str.len() > 0]
    df_clean['burmese'] = df_clean['burmese'].astype(str).str.strip()
    df_clean['category'] = df_clean['category'].ffill()
    
    print(f"  Extracted {len(df_clean)} words")
    return df_clean

def extract_recipes(filepath):
    """Extract data from Recipies_R002.xlsx"""
    print(f"Processing: {filepath}")
    
    df = pd.read_excel(filepath, sheet_name="Final_Selective_N2_kanji", header=None)
    df_clean = df.iloc[2:, [3, 5, 7, 8]].copy()
    df_clean.columns = ['category', 'burmese', 'devanagari', 'meaning']
    df_clean['source'] = 'recipes'
    
    # Clean data
    df_clean = df_clean.dropna(subset=['burmese'])
    df_clean = df_clean[df_clean['burmese'].astype(str).str.strip().str.len() > 0]
    df_clean['burmese'] = df_clean['burmese'].astype(str).str.strip()
    df_clean['category'] = df_clean['category'].ffill()
    
    print(f"  Extracted {len(df_clean)} words")
    return df_clean

def extract_anchor_candidates(all_words, min_frequency=3, min_length=2, max_length=5):
    """Find potential anchor words from the word list"""
    print("\nExtracting anchor word candidates...")
    
    substring_count = Counter()
    substring_words = defaultdict(set)
    
    for _, row in all_words.iterrows():
        word = row['burmese']
        if not word or len(word) < min_length:
            continue
        
        # Extract all substrings
        for length in range(min_length, min(max_length + 1, len(word) + 1)):
            for start in range(len(word) - length + 1):
                substring = word[start:start + length]
                # Must start with a consonant
                if substring and substring[0] in BURMESE_CONSONANTS:
                    # Don't include the word itself
                    if substring != word:
                        substring_count[substring] += 1
                        substring_words[substring].add(word)
    
    # Filter to frequent ones
    anchors = []
    for substr, count in substring_count.most_common():
        if count >= min_frequency:
            first_consonant = get_first_consonant(substr)
            anchors.append({
                'burmese_word': substr,
                'word_count': len(substring_words[substr]),
                'first_consonant': first_consonant,
                'sample_words': list(substring_words[substr])[:5]
            })
    
    print(f"  Found {len(anchors)} anchor candidates")
    return anchors

def generate_sql_inserts(all_words, anchors, output_file):
    """Generate SQL INSERT statements"""
    print(f"\nGenerating SQL inserts: {output_file}")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- Auto-generated data import\n")
        f.write("-- Run this after creating the schema\n\n")
        
        # 1. Categories
        f.write("-- ============ CATEGORIES ============\n")
        categories = all_words[['category', 'source']].drop_duplicates()
        categories = categories.dropna(subset=['category'])
        
        for idx, row in categories.iterrows():
            cat = clean_string(row['category'])
            source = clean_string(row['source'])
            if cat:
                f.write(f"INSERT INTO burmese_categories (name, source) VALUES ('{cat}', '{source}') ON CONFLICT DO NOTHING;\n")
        
        f.write("\n")
        
        # 2. Words
        f.write("-- ============ WORDS ============\n")
        for idx, row in all_words.iterrows():
            burmese = clean_string(row['burmese'])
            devanagari = clean_string(row['devanagari'])
            meaning = clean_string(row['meaning'])
            category = clean_string(row['category'])
            source = clean_string(row['source'])
            first_consonant = get_first_consonant(row['burmese'])
            
            if not burmese:
                continue
            
            f.write(f"""INSERT INTO burmese_words (burmese_word, devanagari, english_meaning, source, word_length, 
    category_id, first_consonant_id)
SELECT '{burmese}', 
    {f"'{devanagari}'" if devanagari else 'NULL'}, 
    {f"'{meaning}'" if meaning else 'NULL'}, 
    '{source}',
    {len(burmese)},
    (SELECT id FROM burmese_categories WHERE name = '{category}' LIMIT 1),
    (SELECT id FROM burmese_consonants WHERE burmese_char = '{first_consonant}' LIMIT 1)
ON CONFLICT DO NOTHING;
""")
        
        f.write("\n")
        
        # 3. Anchor words
        f.write("-- ============ ANCHOR WORDS ============\n")
        for idx, anchor in enumerate(anchors[:200], 1):  # Top 200 anchors
            burmese = clean_string(anchor['burmese_word'])
            first_consonant = anchor['first_consonant']
            word_count = anchor['word_count']
            
            f.write(f"""INSERT INTO burmese_anchor_words (burmese_word, word_count, frequency_rank, is_auto_generated, consonant_id)
SELECT '{burmese}', {word_count}, {idx}, TRUE,
    (SELECT id FROM burmese_consonants WHERE burmese_char = '{first_consonant}' LIMIT 1)
ON CONFLICT (burmese_word) DO UPDATE SET word_count = {word_count};
""")
        
        f.write("\n")
        
        # 4. Run linking function
        f.write("-- ============ LINK WORDS TO ANCHORS ============\n")
        f.write("SELECT link_words_to_anchors();\n")
        f.write("SELECT update_word_consonants();\n")
        
        # 5. Update category word counts
        f.write("\n-- ============ UPDATE COUNTS ============\n")
        f.write("""UPDATE burmese_categories c
SET word_count = (
    SELECT COUNT(*) FROM burmese_words w WHERE w.category_id = c.id
);
""")
    
    print(f"  Generated SQL file: {output_file}")

def generate_csv_files(all_words, anchors, output_dir="."):
    """Generate CSV files for direct Supabase import"""
    print(f"\nGenerating CSV files in: {output_dir}")
    
    # Categories CSV
    categories = all_words[['category', 'source']].drop_duplicates()
    categories = categories.dropna(subset=['category'])
    categories['display_order'] = range(1, len(categories) + 1)
    categories.columns = ['name', 'source', 'display_order']
    categories.to_csv(f"{output_dir}/burmese_categories.csv", index=False)
    print(f"  Created: burmese_categories.csv ({len(categories)} rows)")
    
    # Words CSV
    words_export = all_words.copy()
    words_export['first_consonant'] = words_export['burmese'].apply(get_first_consonant)
    words_export['word_length'] = words_export['burmese'].str.len()
    words_export.columns = ['category_name', 'burmese_word', 'devanagari', 'english_meaning', 'source', 'first_consonant', 'word_length']
    words_export.to_csv(f"{output_dir}/burmese_words.csv", index=False)
    print(f"  Created: burmese_words.csv ({len(words_export)} rows)")
    
    # Anchors CSV
    anchors_df = pd.DataFrame(anchors[:200])  # Top 200
    anchors_df['frequency_rank'] = range(1, len(anchors_df) + 1)
    anchors_df['is_auto_generated'] = True
    anchors_df = anchors_df[['burmese_word', 'word_count', 'first_consonant', 'frequency_rank', 'is_auto_generated']]
    anchors_df.to_csv(f"{output_dir}/burmese_anchor_words.csv", index=False)
    print(f"  Created: burmese_anchor_words.csv ({len(anchors_df)} rows)")

def main():
    """Main function"""
    print("="*60)
    print("BURMESE DATA IMPORT SCRIPT")
    print("="*60)
    
    # File paths (adjust as needed)
    kg_book_file = "KG_book_Burmese.xlsx"
    words_file = "Burmese_Words_R002.xlsx"
    recipes_file = "D:\\Mind_Palace\\LANGUAGES\\Other_languages\\Burmese\\####Organised\\Study_material\\#Books\\Reciepes\\Recipies_R002.xlsx"

    all_data = []
    
    # Extract from each file
    if os.path.exists(kg_book_file):
        all_data.append(extract_kg_book(kg_book_file))
    else:
        print(f"Warning: {kg_book_file} not found")
    
    if os.path.exists(words_file):
        all_data.append(extract_burmese_words(words_file))
    else:
        print(f"Warning: {words_file} not found")
    
    if os.path.exists(recipes_file):
        all_data.append(extract_recipes(recipes_file))
    else:
        print(f"Warning: {recipes_file} not found")
    
    if not all_data:
        print("Error: No data files found!")
        return
    
    # Combine all data
    all_words = pd.concat(all_data, ignore_index=True)
    
    # Remove duplicates
    all_words = all_words.drop_duplicates(subset=['burmese'], keep='first')
    
    print(f"\nTotal unique words: {len(all_words)}")
    
    # Extract anchor candidates
    anchors = extract_anchor_candidates(all_words, min_frequency=3)
    
    # Generate outputs
    generate_sql_inserts(all_words, anchors, "burmese_data_import.sql")
    generate_csv_files(all_words, anchors)
    
    print("\n" + "="*60)
    print("DONE!")
    print("="*60)
    print("""
Next steps:
1. Run burmese_schema.sql in Supabase SQL Editor
2. Run burmese_data_import.sql in Supabase SQL Editor
   OR
   Import the CSV files using Supabase Dashboard

Your data is ready!
""")

if __name__ == "__main__":
    main()
