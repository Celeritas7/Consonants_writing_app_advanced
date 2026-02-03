// Storage Module - LocalStorage + Supabase Integration

const STORAGE_PREFIX = 'burmese_learning_';

// ============================================================
// LOCAL STORAGE OPERATIONS
// ============================================================

export function saveToLocal(key, data) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Error saving to localStorage:', e);
        return false;
    }
}

export function loadFromLocal(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(STORAGE_PREFIX + key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error('Error loading from localStorage:', e);
        return defaultValue;
    }
}

export function removeFromLocal(key) {
    try {
        localStorage.removeItem(STORAGE_PREFIX + key);
        return true;
    } catch (e) {
        console.error('Error removing from localStorage:', e);
        return false;
    }
}

// ============================================================
// PROGRESS TRACKING (LOCAL)
// ============================================================

export function getProgress(language, level) {
    const key = `progress_${language}_${level}`;
    return loadFromLocal(key, {});
}

export function saveProgress(language, level, charId, data) {
    const key = `progress_${language}_${level}`;
    const progress = loadFromLocal(key, {});
    
    if (!progress[charId]) {
        progress[charId] = {
            practiced: false,
            correct: 0,
            incorrect: 0,
            lastPracticed: null,
            attempts: []
        };
    }
    
    Object.assign(progress[charId], data);
    progress[charId].lastPracticed = new Date().toISOString();
    
    saveToLocal(key, progress);
    return progress[charId];
}

export function markPracticed(language, level, charId) {
    return saveProgress(language, level, charId, { practiced: true });
}

export function recordAttempt(language, level, charId, correct) {
    const key = `progress_${language}_${level}`;
    const progress = loadFromLocal(key, {});
    
    if (!progress[charId]) {
        progress[charId] = {
            practiced: true,
            correct: 0,
            incorrect: 0,
            lastPracticed: null,
            attempts: []
        };
    }
    
    if (correct) {
        progress[charId].correct++;
    } else {
        progress[charId].incorrect++;
    }
    
    // Keep last 10 attempts
    progress[charId].attempts.push({
        correct,
        timestamp: new Date().toISOString()
    });
    if (progress[charId].attempts.length > 10) {
        progress[charId].attempts.shift();
    }
    
    progress[charId].lastPracticed = new Date().toISOString();
    progress[charId].practiced = true;
    
    saveToLocal(key, progress);
    return progress[charId];
}

export function getMistakes(language, level) {
    const progress = getProgress(language, level);
    const mistakes = [];
    
    for (const [charId, data] of Object.entries(progress)) {
        if (data.incorrect > 0 || (data.attempts && data.attempts.some(a => !a.correct))) {
            mistakes.push({
                charId,
                ...data
            });
        }
    }
    
    return mistakes;
}

// ============================================================
// APP STATE
// ============================================================

export function getAppState() {
    return loadFromLocal('app_state', {
        currentLanguage: 'burmese',
        currentLevel: 'consonant',
        currentView: 'practice',
        currentIndex: 0,
        practiceMode: 'sequential',
        quizMode: 'sequential',
        dailyTarget: 10,
        showGuide: true,
        strokeWidth: 8
    });
}

export function saveAppState(state) {
    const current = getAppState();
    const newState = { ...current, ...state };
    saveToLocal('app_state', newState);
    return newState;
}

// ============================================================
// SESSION DATA
// ============================================================

export function getSessionData() {
    return loadFromLocal('session', {
        practiced: [],
        correct: 0,
        incorrect: 0,
        streak: 0,
        startTime: new Date().toISOString()
    });
}

export function saveSessionData(data) {
    const current = getSessionData();
    const newData = { ...current, ...data };
    saveToLocal('session', newData);
    return newData;
}

export function resetSession() {
    return saveSessionData({
        practiced: [],
        correct: 0,
        incorrect: 0,
        streak: 0,
        startTime: new Date().toISOString()
    });
}

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

export function getSupabaseConfig() {
    return loadFromLocal('supabase_config', {
        url: '',
        key: '',
        connected: false
    });
}

export function saveSupabaseConfig(url, key) {
    const config = {
        url,
        key,
        connected: !!(url && key)
    };
    saveToLocal('supabase_config', config);
    return config;
}

// ============================================================
// SUPABASE CLIENT
// ============================================================

let supabaseClient = null;

export async function initSupabase() {
    const config = getSupabaseConfig();
    if (!config.url || !config.key) {
        return null;
    }
    
    try {
        // Dynamic import of Supabase
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        supabaseClient = createClient(config.url, config.key);
        return supabaseClient;
    } catch (e) {
        console.error('Failed to initialize Supabase:', e);
        return null;
    }
}

export function getSupabaseClient() {
    return supabaseClient;
}

// ============================================================
// SUPABASE DATA OPERATIONS
// ============================================================

export async function fetchWords(filters = {}) {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        let query = client
            .from('burmese_words')
            .select(`
                id,
                burmese_word,
                devanagari,
                english_meaning,
                hint,
                sentence,
                category_id,
                first_consonant_id,
                burmese_categories (name),
                burmese_consonants (burmese_char, devanagari)
            `)
            .order('burmese_word');
        
        if (filters.categoryId) {
            query = query.eq('category_id', filters.categoryId);
        }
        
        if (filters.consonantId) {
            query = query.eq('first_consonant_id', filters.consonantId);
        }
        
        if (filters.limit) {
            query = query.limit(filters.limit);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching words:', e);
        return [];
    }
}

export async function fetchAnchors() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        const { data, error } = await client
            .from('burmese_anchor_words')
            .select(`
                id,
                burmese_word,
                devanagari,
                meaning,
                group_no,
                word_count,
                consonant_id,
                burmese_consonants (burmese_char, devanagari)
            `)
            .order('group_no');
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching anchors:', e);
        return [];
    }
}

export async function fetchWordsByAnchor(anchorId) {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        const { data, error } = await client
            .from('burmese_word_anchors')
            .select(`
                word_id,
                is_primary,
                burmese_words (
                    id,
                    burmese_word,
                    devanagari,
                    english_meaning,
                    hint,
                    sentence
                )
            `)
            .eq('anchor_id', anchorId);
        
        if (error) throw error;
        return data?.map(d => d.burmese_words) || [];
    } catch (e) {
        console.error('Error fetching words by anchor:', e);
        return [];
    }
}

export async function fetchCategories() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        const { data, error } = await client
            .from('burmese_categories')
            .select('id, name, word_count')
            .order('name');
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching categories:', e);
        return [];
    }
}

export async function fetchConsonants() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        const { data, error } = await client
            .from('burmese_consonants')
            .select('*')
            .order('display_order');
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching consonants:', e);
        return [];
    }
}

// ============================================================
// PROGRESS SYNC WITH SUPABASE
// ============================================================

export async function syncProgressToSupabase(userId, itemType, itemId, eventType, delta = 0) {
    const client = getSupabaseClient();
    if (!client || !userId) return false;
    
    try {
        const { error } = await client
            .from('burmese_progress_events')
            .insert({
                user_id: userId,
                item_type: itemType,
                item_id: itemId,
                event_type: eventType,
                delta: delta,
                device_id: getDeviceId(),
                created_at: new Date().toISOString()
            });
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error syncing progress:', e);
        return false;
    }
}

function getDeviceId() {
    let deviceId = loadFromLocal('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        saveToLocal('device_id', deviceId);
    }
    return deviceId;
}

// ============================================================
// USER ID (anonymous for now)
// ============================================================

export function getUserId() {
    let userId = loadFromLocal('user_id');
    if (!userId) {
        userId = 'anon_' + Math.random().toString(36).substr(2, 9);
        saveToLocal('user_id', userId);
    }
    return userId;
}
