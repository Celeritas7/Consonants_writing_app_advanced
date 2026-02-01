// Main Application - Burmese Learning App
import { burmese } from './languages/burmese.js';
import { DrawingCanvas } from './canvas.js';
import * as storage from './storage.js';

// ============================================================
// GLOBAL STATE
// ============================================================
let currentLanguage = burmese;
let currentLevel = 'consonant'; // consonant, cv, word
let currentView = 'practice';
let currentIndex = 0;
let currentData = []; // Current items to practice
let practiceMode = 'sequential';
let quizMode = 'sequential';

// Canvas instances
let practiceCanvas = null;
let quizCanvas = null;

// Quiz state
let quizStats = { correct: 0, incorrect: 0, streak: 0 };
let answerRevealed = false;
let sessionPracticed = [];

// Supabase data cache
let dbWords = [];
let dbAnchors = [];
let dbCategories = [];
let isConnected = false;

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved state
    const appState = storage.getAppState();
    currentLevel = appState.currentLevel || 'consonant';
    currentView = appState.currentView || 'practice';
    currentIndex = appState.currentIndex || 0;
    practiceMode = appState.practiceMode || 'sequential';
    
    // Initialize UI
    initLanguageTabs();
    initStudyLevelTabs();
    initMainTabs();
    initModeToggles();
    initCanvases();
    initControls();
    initWordFilters();
    
    // Load data for current level
    await loadDataForLevel();
    
    // Update display
    updateDisplay();
    updateStats();
    updateCharGrid();
    updateSheetGrid();
    updateReviewGrid();
    
    // Try to connect to Supabase
    await tryConnectSupabase();
});

// ============================================================
// LANGUAGE TABS
// ============================================================
function initLanguageTabs() {
    const container = document.getElementById('languageTabs');
    container.innerHTML = `
        <button class="lang-tab active" data-lang="burmese">
            <span class="native burmese">မြန်မာ</span>
            <span>Burmese</span>
        </button>
    `;
    
    container.querySelectorAll('.lang-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // For future multi-language support
        });
    });
}

// ============================================================
// STUDY LEVEL TABS (C / C+V / Word / Sentence)
// ============================================================
function initStudyLevelTabs() {
    const tabs = document.querySelectorAll('.study-tab');
    
    // Set active based on saved state
    tabs.forEach(tab => {
        if (tab.dataset.level === currentLevel) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
        
        tab.addEventListener('click', async () => {
            if (tab.classList.contains('disabled')) return;
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentLevel = tab.dataset.level;
            currentIndex = 0;
            storage.saveAppState({ currentLevel, currentIndex });
            
            // Show/hide word filters
            const wordFilters = document.getElementById('wordFilters');
            wordFilters.style.display = currentLevel === 'word' ? 'flex' : 'none';
            
            await loadDataForLevel();
            updateDisplay();
            updateStats();
            updateCharGrid();
            updateSheetGrid();
            updateReviewGrid();
        });
    });
    
    // Initial visibility of word filters
    document.getElementById('wordFilters').style.display = currentLevel === 'word' ? 'flex' : 'none';
}

// ============================================================
// MAIN TABS (Practice / Quiz / Sheet / Review)
// ============================================================
function initMainTabs() {
    const tabs = document.querySelectorAll('.main-tab');
    const views = {
        practice: document.getElementById('practiceView'),
        quiz: document.getElementById('quizView'),
        sheet: document.getElementById('sheetView'),
        review: document.getElementById('reviewView')
    };
    
    // Set active based on saved state
    tabs.forEach(tab => {
        if (tab.dataset.view === currentView) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    Object.entries(views).forEach(([key, view]) => {
        if (key === currentView) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const view = tab.dataset.view;
            currentView = view;
            storage.saveAppState({ currentView });
            
            Object.values(views).forEach(v => v.classList.remove('active'));
            views[view].classList.add('active');
            
            if (view === 'quiz') {
                updateQuizDisplay();
            } else if (view === 'sheet') {
                updateSheetGrid();
            } else if (view === 'review') {
                updateReviewGrid();
            }
        });
    });
}

// ============================================================
// MODE TOGGLES
// ============================================================
function initModeToggles() {
    // Practice mode
    document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
        if (btn.dataset.mode === practiceMode) {
            btn.classList.add('active');
        }
        
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            practiceMode = btn.dataset.mode;
            storage.saveAppState({ practiceMode });
        });
    });
    
    // Quiz mode
    document.querySelectorAll('.mode-btn[data-quiz-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn[data-quiz-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            quizMode = btn.dataset.quizMode;
            storage.saveAppState({ quizMode });
        });
    });
    
    // Review mode
    document.querySelectorAll('.mode-btn[data-review-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn[data-review-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateReviewGrid();
        });
    });
}

// ============================================================
// WORD FILTERS
// ============================================================
function initWordFilters() {
    const groupBy = document.getElementById('wordGroupBy');
    const anchorFilter = document.getElementById('anchorFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    
    groupBy.addEventListener('change', async () => {
        await loadDataForLevel();
        updateDisplay();
        updateCharGrid();
    });
    
    anchorFilter.addEventListener('change', async () => {
        await loadDataForLevel();
        updateDisplay();
        updateCharGrid();
    });
    
    categoryFilter.addEventListener('change', async () => {
        await loadDataForLevel();
        updateDisplay();
        updateCharGrid();
    });
}

async function populateFilterDropdowns() {
    // Populate anchors
    const anchorSelect = document.getElementById('anchorFilter');
    anchorSelect.innerHTML = '<option value="">All Anchors</option>';
    for (const anchor of dbAnchors) {
        const opt = document.createElement('option');
        opt.value = anchor.id;
        opt.textContent = `${anchor.burmese_word} (${anchor.meaning || ''})`;
        anchorSelect.appendChild(opt);
    }
    
    // Populate categories
    const categorySelect = document.getElementById('categoryFilter');
    categorySelect.innerHTML = '<option value="">All Categories</option>';
    for (const cat of dbCategories) {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        categorySelect.appendChild(opt);
    }
}

// ============================================================
// CANVAS INITIALIZATION
// ============================================================
function initCanvases() {
    // Practice canvas
    practiceCanvas = new DrawingCanvas('bgCanvas', 'drawCanvas', 'guideCanvas');
    
    // Quiz canvas
    quizCanvas = new DrawingCanvas('quizBgCanvas', 'quizDrawCanvas');
    
    // Load saved settings
    const appState = storage.getAppState();
    
    // Stroke width
    const strokeSlider = document.getElementById('strokeSlider');
    const strokeValue = document.getElementById('strokeValue');
    strokeSlider.value = appState.strokeWidth || 8;
    strokeValue.textContent = `${strokeSlider.value}px`;
    practiceCanvas.setStrokeWidth(parseInt(strokeSlider.value));
    
    strokeSlider.addEventListener('input', () => {
        strokeValue.textContent = `${strokeSlider.value}px`;
        practiceCanvas.setStrokeWidth(parseInt(strokeSlider.value));
        storage.saveAppState({ strokeWidth: parseInt(strokeSlider.value) });
    });
    
    // Quiz stroke slider
    const quizStrokeSlider = document.getElementById('quizStrokeSlider');
    const quizStrokeValue = document.getElementById('quizStrokeValue');
    quizStrokeSlider.value = appState.strokeWidth || 8;
    quizStrokeValue.textContent = `${quizStrokeSlider.value}px`;
    quizCanvas.setStrokeWidth(parseInt(quizStrokeSlider.value));
    
    quizStrokeSlider.addEventListener('input', () => {
        quizStrokeValue.textContent = `${quizStrokeSlider.value}px`;
        quizCanvas.setStrokeWidth(parseInt(quizStrokeSlider.value));
    });
    
    // Guide toggle
    const showGuide = document.getElementById('showGuide');
    showGuide.checked = appState.showGuide !== false;
    
    showGuide.addEventListener('change', () => {
        storage.saveAppState({ showGuide: showGuide.checked });
        if (showGuide.checked) {
            updateGuideCharacter();
        } else {
            practiceCanvas.hideGuide();
        }
    });
    
    // Sheet guide toggle
    const sheetShowGuide = document.getElementById('sheetShowGuide');
    sheetShowGuide.addEventListener('change', () => {
        document.querySelectorAll('.sheet-cell-char').forEach(el => {
            el.classList.toggle('hide-guide', !sheetShowGuide.checked);
        });
    });
}

// ============================================================
// CONTROLS (Navigation, Actions)
// ============================================================
function initControls() {
    // Navigation buttons
    document.getElementById('prevBtn').addEventListener('click', () => navigatePrev());
    document.getElementById('nextBtn').addEventListener('click', () => navigateNext());
    document.getElementById('randomBtn').addEventListener('click', () => navigateRandom());
    
    // Canvas actions
    document.getElementById('undoBtn').addEventListener('click', () => practiceCanvas.undo());
    document.getElementById('clearBtn').addEventListener('click', () => practiceCanvas.clear());
    document.getElementById('skipBtn').addEventListener('click', () => navigateNext());
    document.getElementById('markDoneBtn').addEventListener('click', () => markCurrentAsDone());
    
    // Quiz navigation
    document.getElementById('quizPrevBtn').addEventListener('click', () => quizNavigatePrev());
    document.getElementById('quizNextBtn').addEventListener('click', () => quizNavigateNext());
    document.getElementById('quizRandomBtn').addEventListener('click', () => quizNavigateRandom());
    
    // Quiz actions
    document.getElementById('quizUndoBtn').addEventListener('click', () => quizCanvas.undo());
    document.getElementById('quizClearBtn').addEventListener('click', () => quizCanvas.clear());
    document.getElementById('quizSkipBtn').addEventListener('click', () => quizNavigateNext());
    document.getElementById('checkAnswerBtn').addEventListener('click', () => revealAnswer());
    document.getElementById('markCorrect').addEventListener('click', () => recordQuizResult(true));
    document.getElementById('markIncorrect').addEventListener('click', () => recordQuizResult(false));
    
    // Daily target
    const dailyTargetInput = document.getElementById('dailyTargetInput');
    const appState = storage.getAppState();
    dailyTargetInput.value = appState.dailyTarget || 10;
    document.getElementById('sessionTarget').textContent = dailyTargetInput.value;
    
    dailyTargetInput.addEventListener('change', () => {
        storage.saveAppState({ dailyTarget: parseInt(dailyTargetInput.value) });
        document.getElementById('sessionTarget').textContent = dailyTargetInput.value;
        updateSessionProgress();
    });
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadDataForLevel() {
    switch (currentLevel) {
        case 'consonant':
            currentData = currentLanguage.consonants.map((c, i) => ({
                id: `c_${i}`,
                char: c.char,
                roman: c.roman,
                devanagari: c.devanagari,
                index: i
            }));
            break;
            
        case 'cv':
            const combinations = currentLanguage.generateCVCombinations();
            currentData = combinations.map((c, i) => ({
                id: `cv_${i}`,
                char: c.char,
                roman: c.roman,
                devanagari: c.devanagari,
                baseConsonant: c.baseConsonant,
                vowel: c.vowel,
                index: i
            }));
            break;
            
        case 'word':
            if (isConnected && dbWords.length > 0) {
                const categoryId = document.getElementById('categoryFilter')?.value;
                
                let filteredWords = dbWords;
                if (categoryId) {
                    filteredWords = dbWords.filter(w => w.category_id === categoryId);
                }
                
                currentData = filteredWords.map((w, i) => ({
                    id: w.id,
                    char: w.burmese_word,
                    roman: w.english_meaning || '',
                    devanagari: w.devanagari || '',
                    meaning: w.english_meaning || '',
                    hint: w.hint || '',
                    sentence: w.sentence || '',
                    category: w.burmese_categories?.name || '',
                    index: i
                }));
            } else {
                // Fallback sample words
                currentData = [
                    { id: 'w1', char: 'ကျွန်တော်', roman: 'I (male)', devanagari: '', meaning: 'I (male speaker)', index: 0 },
                    { id: 'w2', char: 'ကျွန်မ', roman: 'I (female)', devanagari: '', meaning: 'I (female speaker)', index: 1 },
                    { id: 'w3', char: 'သင်', roman: 'you', devanagari: '', meaning: 'you', index: 2 },
                    { id: 'w4', char: 'ထမင်း', roman: 'rice', devanagari: '', meaning: 'rice/meal', index: 3 },
                    { id: 'w5', char: 'ရေ', roman: 'water', devanagari: '', meaning: 'water', index: 4 },
                ];
            }
            break;
    }
    
    // Ensure index is valid
    if (currentIndex >= currentData.length) {
        currentIndex = 0;
    }
}

// ============================================================
// DISPLAY UPDATES
// ============================================================
function updateDisplay() {
    if (currentData.length === 0) return;
    
    const item = currentData[currentIndex];
    
    // Update target character
    const targetChar = document.getElementById('targetChar');
    targetChar.textContent = item.char;
    targetChar.className = `target-char ${currentLanguage.fontClass}`;
    
    // Adjust font size for longer words
    targetChar.classList.remove('word-size-1', 'word-size-2', 'word-size-3', 'word-size-4', 'word-size-5', 'word-size-6');
    if (item.char.length > 5) {
        targetChar.classList.add('word-size-6');
    } else if (item.char.length > 4) {
        targetChar.classList.add('word-size-5');
    } else if (item.char.length > 3) {
        targetChar.classList.add('word-size-4');
    } else if (item.char.length > 2) {
        targetChar.classList.add('word-size-3');
    } else if (item.char.length > 1) {
        targetChar.classList.add('word-size-2');
    }
    
    // Update romanization / devanagari
    const romanization = document.getElementById('romanization');
    if (item.devanagari) {
        romanization.textContent = item.devanagari;
        romanization.className = 'romanization devanagari';
    } else {
        romanization.textContent = item.roman;
        romanization.className = 'romanization';
    }
    
    // Update description
    const levelNames = { consonant: 'Consonant', cv: 'Combination', word: 'Word' };
    document.getElementById('charDescription').textContent = 
        `${levelNames[currentLevel]} ${currentIndex + 1} of ${currentData.length}`;
    
    // Update practice title
    document.getElementById('practiceTitle').textContent = 
        currentLevel === 'word' ? 'Current Word' : 'Current Character';
    
    // Show/hide word meaning section
    const wordMeaning = document.getElementById('wordMeaning');
    if (currentLevel === 'word' && item.meaning) {
        wordMeaning.style.display = 'block';
        document.getElementById('meaningText').textContent = item.meaning;
        document.getElementById('hintText').textContent = item.hint ? `💡 ${item.hint}` : '';
    } else {
        wordMeaning.style.display = 'none';
    }
    
    // Update guide character
    updateGuideCharacter();
    
    // Clear canvas
    practiceCanvas.clear();
}

function updateGuideCharacter() {
    const showGuide = document.getElementById('showGuide').checked;
    if (showGuide && currentData.length > 0) {
        const item = currentData[currentIndex];
        practiceCanvas.drawGuideCharacter(item.char, currentLanguage.fontFamily);
    } else {
        practiceCanvas.hideGuide();
    }
}

function updateStats() {
    const progress = storage.getProgress(currentLanguage.id, currentLevel);
    const total = currentData.length;
    const practiced = Object.values(progress).filter(p => p.practiced).length;
    const percent = total > 0 ? Math.round((practiced / total) * 100) : 0;
    
    document.getElementById('practicedCount').textContent = practiced;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('progressPercent').textContent = `${percent}%`;
}

function updateCharGrid() {
    const grid = document.getElementById('charGrid');
    const quizGrid = document.getElementById('quizCharGrid');
    const progress = storage.getProgress(currentLanguage.id, currentLevel);
    
    let html = '';
    for (const item of currentData) {
        const isPracticed = progress[item.id]?.practiced;
        const isCurrent = item.index === currentIndex;
        const classes = [
            'char-cell',
            currentLanguage.fontClass,
            isPracticed ? 'practiced' : 'unpracticed',
            isCurrent ? 'current' : ''
        ].filter(Boolean).join(' ');
        
        // For words, show first character or truncate
        const displayChar = item.char.length > 2 ? item.char.substring(0, 2) : item.char;
        
        html += `<div class="${classes}" data-index="${item.index}" title="${item.char}">${displayChar}</div>`;
    }
    
    grid.innerHTML = html;
    quizGrid.innerHTML = html;
    
    // Add click handlers
    [grid, quizGrid].forEach(g => {
        g.querySelectorAll('.char-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                currentIndex = parseInt(cell.dataset.index);
                storage.saveAppState({ currentIndex });
                updateDisplay();
                updateCharGrid();
                if (currentView === 'quiz') {
                    updateQuizDisplay();
                }
            });
        });
    });
}

// ============================================================
// NAVIGATION
// ============================================================
function navigatePrev() {
    if (practiceMode === 'sequential') {
        currentIndex = (currentIndex - 1 + currentData.length) % currentData.length;
    } else {
        navigateRandom();
        return;
    }
    storage.saveAppState({ currentIndex });
    updateDisplay();
    updateCharGrid();
}

function navigateNext() {
    if (practiceMode === 'sequential') {
        currentIndex = (currentIndex + 1) % currentData.length;
    } else if (practiceMode === 'unpracticed') {
        const progress = storage.getProgress(currentLanguage.id, currentLevel);
        const unpracticed = currentData.filter(item => !progress[item.id]?.practiced);
        if (unpracticed.length > 0) {
            const randomItem = unpracticed[Math.floor(Math.random() * unpracticed.length)];
            currentIndex = randomItem.index;
        } else {
            currentIndex = (currentIndex + 1) % currentData.length;
        }
    } else {
        navigateRandom();
        return;
    }
    storage.saveAppState({ currentIndex });
    updateDisplay();
    updateCharGrid();
}

function navigateRandom() {
    currentIndex = Math.floor(Math.random() * currentData.length);
    storage.saveAppState({ currentIndex });
    updateDisplay();
    updateCharGrid();
}

function markCurrentAsDone() {
    if (currentData.length === 0) return;
    
    const item = currentData[currentIndex];
    storage.markPracticed(currentLanguage.id, currentLevel, item.id);
    
    // Track session
    if (!sessionPracticed.includes(item.id)) {
        sessionPracticed.push(item.id);
        updateSessionProgress();
    }
    
    updateStats();
    updateCharGrid();
    navigateNext();
}

// ============================================================
// QUIZ MODE
// ============================================================
function updateQuizDisplay() {
    if (currentData.length === 0) return;
    
    const item = currentData[currentIndex];
    
    // Update quiz prompt
    document.getElementById('quizRoman').textContent = item.roman || '';
    document.getElementById('quizDevanagari').textContent = item.devanagari || item.roman;
    document.getElementById('quizDevanagari').className = item.devanagari ? 'quiz-prompt devanagari' : 'quiz-prompt';
    
    document.getElementById('quizDescription').textContent = 
        `Character ${currentIndex + 1} of ${currentData.length}`;
    
    // Update answer character
    document.getElementById('answerChar').textContent = item.char;
    document.getElementById('answerChar').className = `answer-char ${currentLanguage.fontClass}`;
    
    // Hide answer reveal
    document.getElementById('answerReveal').classList.remove('visible');
    answerRevealed = false;
    
    // Show check button, hide nav
    document.getElementById('checkAnswerBtn').style.display = 'inline-block';
    document.getElementById('quizNavButtons').style.display = 'flex';
    
    // Clear quiz canvas
    quizCanvas.clear();
    
    // Update quiz stats display
    document.getElementById('quizCorrect').textContent = quizStats.correct;
    document.getElementById('quizIncorrect').textContent = quizStats.incorrect;
    document.getElementById('quizStreak').textContent = quizStats.streak;
}

function quizNavigatePrev() {
    currentIndex = (currentIndex - 1 + currentData.length) % currentData.length;
    storage.saveAppState({ currentIndex });
    updateQuizDisplay();
    updateCharGrid();
}

function quizNavigateNext() {
    if (quizMode === 'sequential') {
        currentIndex = (currentIndex + 1) % currentData.length;
    } else if (quizMode === 'mistakes') {
        const mistakes = storage.getMistakes(currentLanguage.id, currentLevel);
        if (mistakes.length > 0) {
            const randomMistake = mistakes[Math.floor(Math.random() * mistakes.length)];
            const idx = currentData.findIndex(d => d.id === randomMistake.charId);
            if (idx >= 0) currentIndex = idx;
        }
    } else {
        currentIndex = Math.floor(Math.random() * currentData.length);
    }
    storage.saveAppState({ currentIndex });
    updateQuizDisplay();
    updateCharGrid();
}

function quizNavigateRandom() {
    currentIndex = Math.floor(Math.random() * currentData.length);
    storage.saveAppState({ currentIndex });
    updateQuizDisplay();
    updateCharGrid();
}

function revealAnswer() {
    document.getElementById('answerReveal').classList.add('visible');
    answerRevealed = true;
}

function recordQuizResult(correct) {
    if (currentData.length === 0) return;
    
    const item = currentData[currentIndex];
    storage.recordAttempt(currentLanguage.id, currentLevel, item.id, correct);
    
    if (correct) {
        quizStats.correct++;
        quizStats.streak++;
    } else {
        quizStats.incorrect++;
        quizStats.streak = 0;
    }
    
    // Track session
    if (!sessionPracticed.includes(item.id)) {
        sessionPracticed.push(item.id);
        updateSessionProgress();
    }
    
    updateStats();
    updateCharGrid();
    quizNavigateNext();
}

function updateSessionProgress() {
    const target = parseInt(document.getElementById('dailyTargetInput').value);
    const count = sessionPracticed.length;
    const percent = Math.min(100, Math.round((count / target) * 100));
    
    document.getElementById('sessionCount').textContent = count;
    document.getElementById('sessionProgress').style.width = `${percent}%`;
}

// ============================================================
// PRACTICE SHEET
// ============================================================
function updateSheetGrid() {
    const grid = document.getElementById('sheetGrid');
    const showGuide = document.getElementById('sheetShowGuide').checked;
    
    let html = '';
    for (const item of currentData) {
        const label = item.devanagari || item.roman;
        const charClass = showGuide ? '' : 'hide-guide';
        
        html += `
            <div class="sheet-cell">
                <div class="sheet-cell-label devanagari">${label}</div>
                <div class="sheet-cell-checkbox" data-id="${item.id}"></div>
                <div class="sheet-cell-char ${currentLanguage.fontClass} ${charClass}">${item.char}</div>
            </div>
        `;
    }
    
    grid.innerHTML = html;
    
    // Add checkbox click handlers
    grid.querySelectorAll('.sheet-cell-checkbox').forEach(cb => {
        cb.addEventListener('click', () => {
            cb.classList.toggle('checked');
        });
    });
}

// ============================================================
// REVIEW CHART
// ============================================================
function updateReviewGrid() {
    const grid = document.getElementById('reviewGrid');
    const progress = storage.getProgress(currentLanguage.id, currentLevel);
    const reviewMode = document.querySelector('.mode-btn[data-review-mode].active')?.dataset.reviewMode || 'last5';
    
    let html = '';
    for (const item of currentData) {
        const data = progress[item.id] || { correct: 0, incorrect: 0, attempts: [] };
        
        let score = 0;
        if (reviewMode === 'last5' && data.attempts?.length > 0) {
            const last5 = data.attempts.slice(-5);
            const correctCount = last5.filter(a => a.correct).length;
            score = (correctCount / last5.length) * 100;
        } else if (data.correct + data.incorrect > 0) {
            score = (data.correct / (data.correct + data.incorrect)) * 100;
        }
        
        let strengthClass = 'not-attempted';
        if (data.correct + data.incorrect > 0 || data.attempts?.length > 0) {
            if (score >= 80) strengthClass = 'strong';
            else if (score >= 60) strengthClass = 'good';
            else if (score >= 40) strengthClass = 'medium';
            else if (score >= 20) strengthClass = 'weak';
            else strengthClass = 'very-weak';
        }
        
        const displayChar = item.char.length > 2 ? item.char.substring(0, 2) : item.char;
        const stats = `${data.correct}/${data.correct + data.incorrect}`;
        
        html += `
            <div class="review-cell ${strengthClass}" data-index="${item.index}">
                <div class="review-cell-char ${currentLanguage.fontClass}">${displayChar}</div>
                <div class="review-cell-stats">${stats}</div>
                ${item.devanagari ? `<div class="review-cell-devanagari devanagari">${item.devanagari}</div>` : ''}
            </div>
        `;
    }
    
    grid.innerHTML = html;
    
    // Add click handlers
    grid.querySelectorAll('.review-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            currentIndex = parseInt(cell.dataset.index);
            storage.saveAppState({ currentIndex });
            
            // Switch to practice view
            document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.main-tab[data-view="practice"]').classList.add('active');
            document.querySelectorAll('.practice-view, .quiz-view, .sheet-view, .review-view').forEach(v => v.classList.remove('active'));
            document.getElementById('practiceView').classList.add('active');
            currentView = 'practice';
            
            updateDisplay();
            updateCharGrid();
        });
    });
}

// ============================================================
// SUPABASE CONNECTION
// ============================================================
async function tryConnectSupabase() {
    const client = await storage.initSupabase();
    if (client) {
        isConnected = true;
        updateConnectionStatus(true);
        
        // Load data from Supabase
        dbWords = await storage.fetchWords();
        dbAnchors = await storage.fetchAnchors();
        dbCategories = await storage.fetchCategories();
        
        // Populate filter dropdowns
        await populateFilterDropdowns();
        
        // Reload data if on word level
        if (currentLevel === 'word') {
            await loadDataForLevel();
            updateDisplay();
            updateCharGrid();
        }
    } else {
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    if (connected) {
        status.classList.add('connected');
        status.querySelector('.status-text').textContent = 'Connected to Supabase';
    } else {
        status.classList.remove('connected');
        status.querySelector('.status-text').textContent = 'Offline Mode';
    }
}

// Modal functions (global for onclick)
window.closeSupabaseModal = function() {
    document.getElementById('supabaseModal').style.display = 'none';
};

window.connectSupabase = async function() {
    const url = document.getElementById('supabaseUrl').value.trim();
    const key = document.getElementById('supabaseKey').value.trim();
    
    if (url && key) {
        storage.saveSupabaseConfig(url, key);
        await tryConnectSupabase();
        closeSupabaseModal();
    }
};

// Show modal if not connected (optional - uncomment to enable)
// setTimeout(() => {
//     if (!isConnected) {
//         document.getElementById('supabaseModal').style.display = 'flex';
//     }
// }, 1000);
