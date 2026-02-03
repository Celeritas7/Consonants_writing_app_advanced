// Storage Module - LocalStorage operations

const STORAGE_PREFIX = 'multi_script_';

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
// PROGRESS TRACKING
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
            mistakes.push({ charId, ...data });
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
        currentGroup: 'indic',
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
