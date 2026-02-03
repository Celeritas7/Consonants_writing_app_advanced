// Storage Module - Handles all localStorage operations

const STORAGE_KEY = 'consonantsPracticeApp';

// Default state
const defaultState = {
    currentLang: 'burmese',
    currentView: 'practice',
    currentIndex: 0,
    quizIndex: 0,
    practicedChars: {},
    quizResults: {},
    attemptHistory: {},
    quizCorrectCount: 0,
    quizIncorrectCount: 0,
    dailyTarget: 10,
    sessionPracticed: [],
    sheetShowGuide: true,
    showGuide: true,
    strokeWidth: 8,
    reviewMode: 'last5'
};

// Load state from localStorage
export function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with defaults to handle new properties
            return { ...defaultState, ...parsed };
        }
    } catch (e) {
        console.error('Error loading state:', e);
    }
    return { ...defaultState };
}

// Save state to localStorage
export function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

// Update specific state properties
export function updateState(updates) {
    const currentState = loadState();
    const newState = { ...currentState, ...updates };
    saveState(newState);
    return newState;
}

// Get specific state property
export function getStateProperty(key) {
    const state = loadState();
    return state[key];
}

// Set specific state property
export function setStateProperty(key, value) {
    const state = loadState();
    state[key] = value;
    saveState(state);
    return state;
}

// Clear all data
export function clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
    return { ...defaultState };
}

// Export default state for reference
export { defaultState };
