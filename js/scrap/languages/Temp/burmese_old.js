// Burmese (Myanmar) Language Data
export const burmese = {
    id: 'burmese',
    name: 'Burmese',
    native: 'မြန်မာ',
    fontClass: 'burmese',
    fontFamily: 'Noto Sans Myanmar',
    
    consonants: [
        { char: 'က', roman: 'ka', devanagari: 'क' },
        { char: 'ခ', roman: 'kha', devanagari: 'ख' },
        { char: 'ဂ', roman: 'ga', devanagari: 'ग' },
        { char: 'ဃ', roman: 'gha', devanagari: 'घ' },
        { char: 'င', roman: 'nga', devanagari: 'ङ' },
        { char: 'စ', roman: 'ca', devanagari: 'च' },
        { char: 'ဆ', roman: 'cha', devanagari: 'छ' },
        { char: 'ဇ', roman: 'ja', devanagari: 'ज' },
        { char: 'ဈ', roman: 'jha', devanagari: 'झ' },
        { char: 'ည', roman: 'nya', devanagari: 'ञ' },
        { char: 'ဋ', roman: 'ṭa', devanagari: 'ट' },
        { char: 'ဌ', roman: 'ṭha', devanagari: 'ठ' },
        { char: 'ဍ', roman: 'ḍa', devanagari: 'ड' },
        { char: 'ဎ', roman: 'ḍha', devanagari: 'ढ' },
        { char: 'ဏ', roman: 'ṇa', devanagari: 'ण' },
        { char: 'တ', roman: 'ta', devanagari: 'त' },
        { char: 'ထ', roman: 'tha', devanagari: 'थ' },
        { char: 'ဒ', roman: 'da', devanagari: 'द' },
        { char: 'ဓ', roman: 'dha', devanagari: 'ध' },
        { char: 'န', roman: 'na', devanagari: 'न' },
        { char: 'ပ', roman: 'pa', devanagari: 'प' },
        { char: 'ဖ', roman: 'pha', devanagari: 'फ' },
        { char: 'ဗ', roman: 'ba', devanagari: 'ब' },
        { char: 'ဘ', roman: 'bha', devanagari: 'भ' },
        { char: 'မ', roman: 'ma', devanagari: 'म' },
        { char: 'ယ', roman: 'ya', devanagari: 'य' },
        { char: 'ရ', roman: 'ra', devanagari: 'र' },
        { char: 'လ', roman: 'la', devanagari: 'ल' },
        { char: 'ဝ', roman: 'wa', devanagari: 'व' },
        { char: 'သ', roman: 'sa', devanagari: 'श' },
        { char: 'ဟ', roman: 'ha', devanagari: 'ह' },
        { char: 'ဠ', roman: 'ḷa', devanagari: 'ळ' },
        { char: 'အ', roman: 'a', devanagari: 'अ' }
    ],

    // Vowels for future use
    vowels: [
        { char: 'ာ', roman: 'ā', devanagari: 'ा' },
        { char: 'ိ', roman: 'i', devanagari: 'ि' },
        { char: 'ီ', roman: 'ī', devanagari: 'ी' },
        { char: 'ု', roman: 'u', devanagari: 'ु' },
        { char: 'ူ', roman: 'ū', devanagari: 'ू' },
        { char: 'ေ', roman: 'e', devanagari: 'े' },
        { char: 'ဲ', roman: 'ai', devanagari: 'ै' },
        { char: 'ော', roman: 'o', devanagari: 'ो' },
        { char: 'ော်', roman: 'au', devanagari: 'ौ' }
    ],

    // Language-specific helper methods
    getDisplayLabel(charData) {
        return charData.devanagari || charData.roman;
    },

    hasDevanagari: true
};
