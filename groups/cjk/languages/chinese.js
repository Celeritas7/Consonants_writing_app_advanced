// Chinese (Basic Characters) Language Data

export const chinese = {
    id: 'chinese',
    name: 'Chinese',
    native: '汉字',
    fontClass: 'chinese',
    fontFamily: 'Noto Sans SC',
    
    // Basic characters for beginners
    consonants: [
        { char: '一', roman: 'yī (one)', meaning: 'one' },
        { char: '二', roman: 'èr (two)', meaning: 'two' },
        { char: '三', roman: 'sān (three)', meaning: 'three' },
        { char: '四', roman: 'sì (four)', meaning: 'four' },
        { char: '五', roman: 'wǔ (five)', meaning: 'five' },
        { char: '六', roman: 'liù (six)', meaning: 'six' },
        { char: '七', roman: 'qī (seven)', meaning: 'seven' },
        { char: '八', roman: 'bā (eight)', meaning: 'eight' },
        { char: '九', roman: 'jiǔ (nine)', meaning: 'nine' },
        { char: '十', roman: 'shí (ten)', meaning: 'ten' },
        { char: '大', roman: 'dà (big)', meaning: 'big' },
        { char: '小', roman: 'xiǎo (small)', meaning: 'small' },
        { char: '人', roman: 'rén (person)', meaning: 'person' },
        { char: '口', roman: 'kǒu (mouth)', meaning: 'mouth' },
        { char: '日', roman: 'rì (sun)', meaning: 'sun/day' },
        { char: '月', roman: 'yuè (moon)', meaning: 'moon/month' },
        { char: '山', roman: 'shān (mountain)', meaning: 'mountain' },
        { char: '水', roman: 'shuǐ (water)', meaning: 'water' },
        { char: '火', roman: 'huǒ (fire)', meaning: 'fire' },
        { char: '木', roman: 'mù (wood)', meaning: 'wood/tree' },
        { char: '金', roman: 'jīn (gold)', meaning: 'gold/metal' },
        { char: '土', roman: 'tǔ (earth)', meaning: 'earth/soil' },
        { char: '天', roman: 'tiān (sky)', meaning: 'sky/heaven' },
        { char: '中', roman: 'zhōng (middle)', meaning: 'middle/center' }
    ],

    vowels: [],

    getDisplayLabel(charData) {
        return charData.roman.split(' ')[0]; // Return just the pinyin
    },

    hasDevanagari: false
};
