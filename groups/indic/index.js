// Indic Languages Index - Brahmic Script Family
// All these languages share the Devanagari anchor system

import { burmese } from './languages/burmese.js';
import { hindi } from './languages/hindi.js';
import { telugu } from './languages/telugu.js';

// Group metadata
export const groupInfo = {
    id: 'indic',
    name: 'Indic Scripts',
    description: 'Brahmic/Abugida script family - Consonant + Vowel (matra) system',
    anchorType: 'devanagari',
    learningPattern: ['consonant', 'cv', 'word', 'sentence'],
    features: {
        hasDevanagariAnchor: true,
        hasInherentVowel: true,  // Consonants have inherent 'a'
        hasMatras: true,         // Vowels attach as diacritics
        hasMedials: true,        // For Burmese
        hasFinals: true          // Final consonant markers
    }
};

// Export all Indic languages
export const languages = {
    burmese,
    hindi,
    telugu
};

// Export individual languages
export { burmese, hindi, telugu };

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
        native: lang.native,
        hasDevanagari: lang.hasDevanagari
    }));
}
