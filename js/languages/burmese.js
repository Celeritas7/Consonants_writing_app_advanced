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

    // Vowel signs (dependent vowels/matras)
    vowels: [
        { char: 'ါ', roman: 'ā', devanagari: 'ा', name: 'aa' },
        { char: 'ာ', roman: 'ā', devanagari: 'ा', name: 'aa-alt' },
        { char: 'ိ', roman: 'i', devanagari: 'ि', name: 'i' },
        { char: 'ီ', roman: 'ī', devanagari: 'ी', name: 'ii' },
        { char: 'ု', roman: 'u', devanagari: 'ु', name: 'u' },
        { char: 'ူ', roman: 'ū', devanagari: 'ू', name: 'uu' },
        { char: 'ေ', roman: 'e', devanagari: 'े', name: 'e' },
        { char: 'ဲ', roman: 'ai', devanagari: 'ै', name: 'ai' },
        { char: 'ော', roman: 'o', devanagari: 'ो', name: 'o' },
        { char: 'ို', roman: 'o', devanagari: 'ो', name: 'o-alt' }
    ],

    // Medial consonants
    medials: [
        { char: 'ျ', roman: '-y-', name: 'ya-medial' },
        { char: 'ြ', roman: '-r-', name: 'ra-medial' },
        { char: 'ွ', roman: '-w-', name: 'wa-medial' },
        { char: 'ှ', roman: '-h-', name: 'ha-medial' }
    ],

    // Final consonant markers
    finals: [
        { char: '်', roman: '', name: 'asat/virama' },
        { char: 'ံ', roman: 'ṃ', devanagari: 'ं', name: 'anusvara' },
        { char: '့', roman: '', name: 'visarga-like' },
        { char: 'း', roman: 'ḥ', devanagari: 'ः', name: 'visarga' }
    ],

    // Generate C+V combinations dynamically
    generateCVCombinations() {
        const combinations = [];
        const basicVowels = this.vowels.filter(v => !v.name.includes('alt'));
        
        for (const consonant of this.consonants) {
            for (const vowel of basicVowels) {
                let combined;
                // Handle pre-vowel 'ေ' which goes before the consonant visually
                if (vowel.char === 'ေ') {
                    combined = vowel.char + consonant.char;
                } else {
                    combined = consonant.char + vowel.char;
                }
                
                combinations.push({
                    char: combined,
                    baseConsonant: consonant.char,
                    vowel: vowel.char,
                    roman: consonant.roman.replace('a', '') + vowel.roman,
                    devanagari: consonant.devanagari + (vowel.devanagari || '')
                });
            }
        }
        return combinations;
    },

    // Language-specific helper methods
    getDisplayLabel(charData) {
        return charData.devanagari || charData.roman;
    },

    hasDevanagari: true
};
