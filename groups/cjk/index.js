// CJK Languages Index - Chinese, Japanese, Korean
// These languages use logographic or syllabic systems

import { japanese_hiragana, japanese_katakana } from './japanese.js';
import { korean } from './korean.js';
import { chinese } from './chinese.js';

// Group metadata
export const groupInfo = {
    id: 'cjk',
    name: 'CJK Scripts',
    description: 'Chinese, Japanese, Korean - Logographic and Syllabic systems',
    anchorType: 'radical',  // or 'jamo' for Korean
    learningPattern: ['character', 'word', 'sentence'],  // No C+V for these
    features: {
        hasDevanagariAnchor: false,
        hasRadicals: true,      // For Chinese/Japanese Kanji
        hasJamo: true,          // For Korean
        hasStrokeOrder: true,   // Stroke order matters
        hasPinyin: true         // For Chinese
    }
};

// Export all CJK languages
export const languages = {
    japanese_hiragana,
    japanese_katakana,
    korean,
    chinese
};

// Export individual languages
export { japanese_hiragana, japanese_katakana, korean, chinese };

// Helper functions
export function getLanguage(id) {
    return languages[id] || null;
}

export function getLanguageIds() {
    return Object.keys(languages);
}

export function getLanguageList() {
    return Object.values(languages).map(lang => ({
        id: lang.id,
        name: lang.name,
        native: lang.native
    }));
}
