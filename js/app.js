// Main Application Module

import { languages, getLanguage } from './languages/index.js';
import { loadState, saveState, updateState } from './storage.js';
import { DrawingCanvas } from './canvas.js';

// App State
let state = loadState();
let practiceCanvas = null;
let quizCanvas = null;

// DOM Elements cache
const elements = {};

// Initialize the application
export function init() {
    cacheElements();
    setupCanvases();
    renderLanguageTabs();
    setupEventListeners();
    restoreView();
    updateAllDisplays();
}

// Cache DOM elements
function cacheElements() {
    elements.languageTabs = document.getElementById('languageTabs');
    elements.practicedCount = document.getElementById('practicedCount');
    elements.totalCount = document.getElementById('totalCount');
    elements.progressPercent = document.getElementById('progressPercent');
    
    // Practice view elements
    elements.targetChar = document.getElementById('targetChar');
    elements.romanization = document.getElementById('romanization');
    elements.charDescription = document.getElementById('charDescription');
    elements.charGrid = document.getElementById('charGrid');
    
    // Quiz view elements
    elements.quizDevanagari = document.getElementById('quizDevanagari');
    elements.quizRoman = document.getElementById('quizRoman');
    elements.quizDescription = document.getElementById('quizDescription');
    elements.answerReveal = document.getElementById('answerReveal');
    elements.answerChar = document.getElementById('answerChar');
    elements.quizCharGrid = document.getElementById('quizCharGrid');
    elements.quizNavButtons = document.getElementById('quizNavButtons');
    elements.quizCorrect = document.getElementById('quizCorrect');
    elements.quizIncorrect = document.getElementById('quizIncorrect');
    elements.quizStreak = document.getElementById('quizStreak');
    
    // Daily target elements
    elements.dailyTargetInput = document.getElementById('dailyTargetInput');
    elements.sessionProgress = document.getElementById('sessionProgress');
    elements.sessionCount = document.getElementById('sessionCount');
    elements.sessionTarget = document.getElementById('sessionTarget');
    
    // Sheet and Review elements
    elements.sheetGrid = document.getElementById('sheetGrid');
    elements.reviewGrid = document.getElementById('reviewGrid');
}

// Setup canvases
function setupCanvases() {
    practiceCanvas = new DrawingCanvas('bgCanvas', 'guideCanvas', 'drawCanvas');
    practiceCanvas.setup();
    
    // Quiz canvas will be setup when quiz view is shown
}

function setupQuizCanvas() {
    if (!quizCanvas) {
        quizCanvas = new DrawingCanvas('quizBgCanvas', null, 'quizDrawCanvas');
    }
    quizCanvas.setup();
}

// Render language tabs
function renderLanguageTabs() {
    if (!elements.languageTabs) return;
    
    elements.languageTabs.innerHTML = '';
    
    Object.keys(languages).forEach(key => {
        const lang = languages[key];
        const tab = document.createElement('button');
        tab.className = `lang-tab ${key === state.currentLang ? 'active' : ''}`;
        tab.innerHTML = `${lang.name} <span class="native ${lang.fontClass}">${lang.native}</span>`;
        tab.onclick = () => switchLanguage(key);
        elements.languageTabs.appendChild(tab);
    });
}

// Switch language
function switchLanguage(langKey) {
    state.currentLang = langKey;
    state.currentIndex = 0;
    state.quizIndex = 0;
    state.sessionPracticed = [];
    
    saveState(state);
    renderLanguageTabs();
    updateAllDisplays();
    
    if (practiceCanvas) practiceCanvas.clear();
    if (quizCanvas) quizCanvas.clear();
    hideAnswerReveal();
}

// Restore view from saved state
function restoreView() {
    const view = state.currentView || 'practice';
    switchView(view);
}

// Switch between views
function switchView(viewName) {
    state.currentView = viewName;
    saveState(state);
    
    // Update tab buttons
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });
    
    // Update view visibility
    document.getElementById('practiceView')?.classList.toggle('active', viewName === 'practice');
    document.getElementById('quizView')?.classList.toggle('active', viewName === 'quiz');
    document.getElementById('sheetView')?.classList.toggle('active', viewName === 'sheet');
    document.getElementById('reviewView')?.classList.toggle('active', viewName === 'review');
    
    // Setup quiz canvas when quiz view is shown
    if (viewName === 'quiz') {
        setTimeout(() => {
            setupQuizCanvas();
            updateQuizDisplay();
        }, 100);
    } else if (viewName === 'sheet') {
        renderPracticeSheet();
    } else if (viewName === 'review') {
        renderReviewChart();
    }
}

// Update all displays
function updateAllDisplays() {
    updatePracticeDisplay();
    updateQuizDisplay();
    updateStats();
    renderPracticeSheet();
    renderReviewChart();
}

// Update practice display
function updatePracticeDisplay() {
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    const charData = lang.consonants[state.currentIndex];
    if (!charData) return;
    
    // Update target character
    if (elements.targetChar) {
        elements.targetChar.textContent = charData.char;
        elements.targetChar.className = `target-char ${lang.fontClass}`;
    }
    
    // Update info
    if (elements.romanization) {
        elements.romanization.textContent = charData.roman;
    }
    
    if (elements.charDescription) {
        const devanagariText = charData.devanagari ? `${charData.devanagari} • ` : '';
        elements.charDescription.textContent = `${devanagariText}Character ${state.currentIndex + 1} of ${lang.consonants.length}`;
    }
    
    // Draw guide
    if (practiceCanvas && state.showGuide) {
        practiceCanvas.drawGuide(charData.char, lang.fontFamily, state.showGuide);
    }
    
    // Update grid
    renderCharGrid();
}

// Render character grid for practice view
function renderCharGrid() {
    if (!elements.charGrid) return;
    
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    elements.charGrid.innerHTML = '';
    
    lang.consonants.forEach((charData, index) => {
        const cell = document.createElement('div');
        cell.className = `char-cell ${lang.fontClass}`;
        
        if (index === state.currentIndex) {
            cell.classList.add('current');
        } else if (isPracticed(index)) {
            cell.classList.add('practiced');
        } else {
            cell.classList.add('unpracticed');
        }
        
        cell.textContent = charData.char;
        cell.onclick = () => jumpToChar(index);
        elements.charGrid.appendChild(cell);
    });
}

// Check if character is practiced
function isPracticed(index) {
    const key = `${state.currentLang}_${index}`;
    return state.practicedChars[key] === true;
}

// Navigate characters
function navigate(delta) {
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    const total = lang.consonants.length;
    
    if (state.practiceMode === 'unpracticed') {
        const unpracticedIndices = [];
        for (let i = 0; i < total; i++) {
            if (!isPracticed(i)) unpracticedIndices.push(i);
        }
        if (unpracticedIndices.length === 0) {
            state.currentIndex = (state.currentIndex + delta + total) % total;
        } else {
            const currentIdx = unpracticedIndices.indexOf(state.currentIndex);
            if (currentIdx === -1) {
                state.currentIndex = unpracticedIndices[0];
            } else {
                const newIdx = (currentIdx + delta + unpracticedIndices.length) % unpracticedIndices.length;
                state.currentIndex = unpracticedIndices[newIdx];
            }
        }
    } else {
        state.currentIndex = (state.currentIndex + delta + total) % total;
    }
    
    if (practiceCanvas) practiceCanvas.clear();
    saveState(state);
    updatePracticeDisplay();
}

// Go to random character
function goRandom() {
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    state.currentIndex = Math.floor(Math.random() * lang.consonants.length);
    
    if (practiceCanvas) practiceCanvas.clear();
    saveState(state);
    updatePracticeDisplay();
}

// Jump to specific character
function jumpToChar(index) {
    state.currentIndex = index;
    if (practiceCanvas) practiceCanvas.clear();
    saveState(state);
    updatePracticeDisplay();
}

// Mark as done
function markAsDone() {
    const key = `${state.currentLang}_${state.currentIndex}`;
    state.practicedChars[key] = true;
    saveState(state);
    updateStats();
    updatePracticeDisplay();
    
    setTimeout(() => navigate(1), 300);
}

// Update stats display
function updateStats() {
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    let practicedCount = 0;
    for (let i = 0; i < lang.consonants.length; i++) {
        if (isPracticed(i)) practicedCount++;
    }
    
    if (elements.practicedCount) {
        elements.practicedCount.textContent = practicedCount;
    }
    if (elements.totalCount) {
        elements.totalCount.textContent = lang.consonants.length;
    }
    if (elements.progressPercent) {
        elements.progressPercent.textContent = Math.round((practicedCount / lang.consonants.length) * 100) + '%';
    }
}

// ========== QUIZ MODE FUNCTIONS ==========

function updateQuizDisplay() {
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    const charData = lang.consonants[state.quizIndex];
    if (!charData) return;
    
    // Update quiz prompt
    if (elements.quizDevanagari) {
        if (lang.hasDevanagari && charData.devanagari) {
            elements.quizDevanagari.textContent = charData.devanagari;
            elements.quizDevanagari.className = 'quiz-prompt devanagari';
        } else {
            elements.quizDevanagari.textContent = '?';
            elements.quizDevanagari.className = 'quiz-prompt';
        }
    }
    
    if (elements.quizRoman) {
        elements.quizRoman.textContent = charData.roman;
    }
    
    if (elements.quizDescription) {
        elements.quizDescription.textContent = `Character ${state.quizIndex + 1} of ${lang.consonants.length}`;
    }
    
    updateQuizStats();
    updateSessionProgress();
    renderQuizCharGrid();
}

function updateQuizStats() {
    if (elements.quizCorrect) {
        elements.quizCorrect.textContent = state.quizCorrectCount;
    }
    if (elements.quizIncorrect) {
        elements.quizIncorrect.textContent = state.quizIncorrectCount;
    }
    if (elements.quizStreak) {
        elements.quizStreak.textContent = state.quizStreak || 0;
    }
}

function updateSessionProgress() {
    const practiced = state.sessionPracticed?.length || 0;
    const target = state.dailyTarget || 10;
    
    if (elements.sessionCount) {
        elements.sessionCount.textContent = practiced;
    }
    if (elements.sessionTarget) {
        elements.sessionTarget.textContent = target;
    }
    if (elements.sessionProgress) {
        const percent = Math.min((practiced / target) * 100, 100);
        elements.sessionProgress.style.width = `${percent}%`;
    }
}

function renderQuizCharGrid() {
    if (!elements.quizCharGrid) return;
    
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    elements.quizCharGrid.innerHTML = '';
    
    lang.consonants.forEach((charData, index) => {
        const cell = document.createElement('div');
        const key = `${state.currentLang}_${index}`;
        cell.className = `char-cell quiz-grid-cell`;
        
        if (index === state.quizIndex) {
            cell.classList.add('current');
        } else if (state.quizResults[key] === 'correct') {
            cell.classList.add('practiced', 'correct-answer');
        } else if (state.quizResults[key] === 'incorrect') {
            cell.classList.add('unpracticed', 'incorrect-answer');
        } else {
            cell.classList.add('unpracticed');
        }
        
        // Show Devanagari or romanization
        if (charData.devanagari) {
            cell.textContent = charData.devanagari;
            cell.classList.add('devanagari');
        } else {
            cell.textContent = charData.roman.substring(0, 2);
            cell.style.fontSize = '0.8rem';
        }
        
        cell.onclick = () => jumpToQuizChar(index);
        elements.quizCharGrid.appendChild(cell);
    });
}

function quizNavigate(delta) {
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    const total = lang.consonants.length;
    
    if (state.quizMode === 'mistakes') {
        const mistakeIndices = [];
        for (let i = 0; i < total; i++) {
            const key = `${state.currentLang}_${i}`;
            if (state.quizResults[key] === 'incorrect') mistakeIndices.push(i);
        }
        if (mistakeIndices.length === 0) {
            state.quizIndex = (state.quizIndex + delta + total) % total;
        } else {
            const currentIdx = mistakeIndices.indexOf(state.quizIndex);
            if (currentIdx === -1) {
                state.quizIndex = mistakeIndices[0];
            } else {
                const newIdx = (currentIdx + delta + mistakeIndices.length) % mistakeIndices.length;
                state.quizIndex = mistakeIndices[newIdx];
            }
        }
    } else {
        state.quizIndex = (state.quizIndex + delta + total) % total;
    }
    
    if (quizCanvas) quizCanvas.clear();
    hideAnswerReveal();
    saveState(state);
    updateQuizDisplay();
}

function quizGoRandom() {
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    // Get characters not yet practiced in this session (up to daily target)
    const target = state.dailyTarget || 10;
    const sessionPracticed = state.sessionPracticed || [];
    
    if (sessionPracticed.length >= target) {
        // Daily target reached, pick from any
        state.quizIndex = Math.floor(Math.random() * lang.consonants.length);
    } else {
        // Pick from unpracticed in session
        const unpracticed = [];
        for (let i = 0; i < lang.consonants.length; i++) {
            if (!sessionPracticed.includes(i)) {
                unpracticed.push(i);
            }
        }
        
        if (unpracticed.length > 0) {
            state.quizIndex = unpracticed[Math.floor(Math.random() * unpracticed.length)];
        } else {
            state.quizIndex = Math.floor(Math.random() * lang.consonants.length);
        }
    }
    
    if (quizCanvas) quizCanvas.clear();
    hideAnswerReveal();
    saveState(state);
    updateQuizDisplay();
}

function jumpToQuizChar(index) {
    state.quizIndex = index;
    if (quizCanvas) quizCanvas.clear();
    hideAnswerReveal();
    saveState(state);
    updateQuizDisplay();
}

function revealAnswer() {
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    const charData = lang.consonants[state.quizIndex];
    
    if (elements.answerChar) {
        elements.answerChar.textContent = charData.char;
        elements.answerChar.className = `answer-char ${lang.fontClass}`;
    }
    
    if (elements.answerReveal) {
        elements.answerReveal.classList.add('visible');
    }
    if (elements.quizNavButtons) {
        elements.quizNavButtons.style.display = 'none';
    }
}

function hideAnswerReveal() {
    if (elements.answerReveal) {
        elements.answerReveal.classList.remove('visible');
    }
    if (elements.quizNavButtons) {
        elements.quizNavButtons.style.display = 'flex';
    }
}

function markQuizResult(isCorrect) {
    const key = `${state.currentLang}_${state.quizIndex}`;
    state.quizResults[key] = isCorrect ? 'correct' : 'incorrect';
    
    // Track attempt history
    if (!state.attemptHistory[key]) {
        state.attemptHistory[key] = [];
    }
    state.attemptHistory[key].push(isCorrect);
    if (state.attemptHistory[key].length > 10) {
        state.attemptHistory[key].shift();
    }
    
    // Track session progress
    if (!state.sessionPracticed) {
        state.sessionPracticed = [];
    }
    if (!state.sessionPracticed.includes(state.quizIndex)) {
        state.sessionPracticed.push(state.quizIndex);
    }
    
    if (isCorrect) {
        state.quizCorrectCount = (state.quizCorrectCount || 0) + 1;
        state.quizStreak = (state.quizStreak || 0) + 1;
    } else {
        state.quizIncorrectCount = (state.quizIncorrectCount || 0) + 1;
        state.quizStreak = 0;
    }
    
    saveState(state);
    updateQuizStats();
    updateSessionProgress();
    renderReviewChart();
    
    setTimeout(() => {
        quizGoRandom(); // Go to next random character
    }, 300);
}

function setDailyTarget(target) {
    state.dailyTarget = parseInt(target) || 10;
    saveState(state);
    updateSessionProgress();
}

// ========== PRACTICE SHEET FUNCTIONS ==========

function renderPracticeSheet() {
    if (!elements.sheetGrid) return;
    
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    elements.sheetGrid.innerHTML = '';
    
    lang.consonants.forEach((charData, index) => {
        const cell = document.createElement('div');
        cell.className = 'sheet-cell';
        
        // Label
        const label = document.createElement('div');
        label.className = 'sheet-cell-label';
        label.textContent = charData.devanagari || charData.roman;
        cell.appendChild(label);
        
        // Checkbox
        const checkbox = document.createElement('div');
        checkbox.className = 'sheet-cell-checkbox';
        const key = `sheet_${state.currentLang}_${index}`;
        if (state.practicedChars[key]) {
            checkbox.classList.add('checked');
        }
        checkbox.onclick = (e) => {
            e.stopPropagation();
            state.practicedChars[key] = !state.practicedChars[key];
            checkbox.classList.toggle('checked');
            saveState(state);
        };
        cell.appendChild(checkbox);
        
        // Ghost character
        const charEl = document.createElement('div');
        charEl.className = `sheet-cell-char ${lang.fontClass}`;
        if (!state.sheetShowGuide) {
            charEl.classList.add('hide-guide');
        }
        charEl.textContent = charData.char;
        cell.appendChild(charEl);
        
        elements.sheetGrid.appendChild(cell);
    });
}

// ========== REVIEW CHART FUNCTIONS ==========

function getStrengthClass(successRate) {
    if (successRate >= 0.8) return 'strong';
    if (successRate >= 0.6) return 'good';
    if (successRate >= 0.4) return 'medium';
    if (successRate >= 0.2) return 'weak';
    return 'very-weak';
}

function calculateSuccessRate(key, mode) {
    const history = state.attemptHistory[key];
    if (!history || history.length === 0) return null;
    
    const attempts = mode === 'last5' ? history.slice(-5) : history;
    const correct = attempts.filter(a => a === true).length;
    return correct / attempts.length;
}

function renderReviewChart() {
    if (!elements.reviewGrid) return;
    
    const lang = languages[state.currentLang];
    if (!lang) return;
    
    elements.reviewGrid.innerHTML = '';
    
    lang.consonants.forEach((charData, index) => {
        const key = `${state.currentLang}_${index}`;
        const cell = document.createElement('div');
        cell.className = 'review-cell';
        
        const successRate = calculateSuccessRate(key, state.reviewMode);
        const history = state.attemptHistory[key] || [];
        
        if (successRate === null) {
            cell.classList.add('not-attempted');
        } else {
            cell.classList.add(getStrengthClass(successRate));
        }
        
        // Main character
        const charEl = document.createElement('div');
        charEl.className = `review-cell-char ${lang.fontClass}`;
        charEl.textContent = charData.char;
        cell.appendChild(charEl);
        
        // Devanagari/romanization
        const devanagariEl = document.createElement('div');
        devanagariEl.className = 'review-cell-devanagari';
        devanagariEl.textContent = charData.devanagari || charData.roman;
        cell.appendChild(devanagariEl);
        
        // Stats
        if (history.length > 0) {
            const statsEl = document.createElement('div');
            statsEl.className = 'review-cell-stats';
            const relevantHistory = state.reviewMode === 'last5' ? history.slice(-5) : history;
            const correct = relevantHistory.filter(a => a === true).length;
            statsEl.textContent = `${correct}/${relevantHistory.length}`;
            cell.appendChild(statsEl);
        }
        
        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'review-tooltip';
        if (history.length > 0) {
            const relevantHistory = state.reviewMode === 'last5' ? history.slice(-5) : history;
            const correct = relevantHistory.filter(a => a === true).length;
            const rate = Math.round((correct / relevantHistory.length) * 100);
            tooltip.textContent = `${charData.roman}: ${correct}/${relevantHistory.length} (${rate}%)`;
        } else {
            tooltip.textContent = `${charData.roman}: Not attempted`;
        }
        cell.appendChild(tooltip);
        
        // Click to practice
        cell.onclick = () => {
            state.quizIndex = index;
            switchView('quiz');
            setTimeout(() => {
                if (quizCanvas) quizCanvas.clear();
                hideAnswerReveal();
                updateQuizDisplay();
            }, 150);
        };
        
        elements.reviewGrid.appendChild(cell);
    });
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
    // Navigation buttons
    document.getElementById('prevBtn')?.addEventListener('click', () => navigate(-1));
    document.getElementById('nextBtn')?.addEventListener('click', () => navigate(1));
    document.getElementById('randomBtn')?.addEventListener('click', goRandom);
    
    // Practice actions
    document.getElementById('clearBtn')?.addEventListener('click', () => practiceCanvas?.clear());
    document.getElementById('undoBtn')?.addEventListener('click', () => practiceCanvas?.undo());
    document.getElementById('markDoneBtn')?.addEventListener('click', markAsDone);
    document.getElementById('skipBtn')?.addEventListener('click', () => navigate(1));
    
    // Stroke width
    document.getElementById('strokeSlider')?.addEventListener('input', (e) => {
        state.strokeWidth = parseInt(e.target.value);
        if (practiceCanvas) practiceCanvas.setStrokeWidth(state.strokeWidth);
        document.getElementById('strokeValue').textContent = state.strokeWidth + 'px';
        saveState(state);
    });
    
    // Guide toggle
    document.getElementById('showGuide')?.addEventListener('change', (e) => {
        state.showGuide = e.target.checked;
        const lang = languages[state.currentLang];
        const charData = lang?.consonants[state.currentIndex];
        if (practiceCanvas && charData) {
            practiceCanvas.drawGuide(charData.char, lang.fontFamily, state.showGuide);
        }
        saveState(state);
    });
    
    // Practice mode toggle
    document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.practiceMode = btn.dataset.mode;
            saveState(state);
        });
    });
    
    // Main view tabs
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
    
    // Quiz mode toggle
    document.querySelectorAll('.mode-btn[data-quiz-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn[data-quiz-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.quizMode = btn.dataset.quizMode;
            saveState(state);
        });
    });
    
    // Quiz navigation
    document.getElementById('quizPrevBtn')?.addEventListener('click', () => quizNavigate(-1));
    document.getElementById('quizNextBtn')?.addEventListener('click', () => quizNavigate(1));
    document.getElementById('quizRandomBtn')?.addEventListener('click', quizGoRandom);
    
    // Quiz actions
    document.getElementById('quizClearBtn')?.addEventListener('click', () => quizCanvas?.clear());
    document.getElementById('quizUndoBtn')?.addEventListener('click', () => quizCanvas?.undo());
    document.getElementById('quizSkipBtn')?.addEventListener('click', quizGoRandom);
    document.getElementById('checkAnswerBtn')?.addEventListener('click', revealAnswer);
    document.getElementById('markCorrect')?.addEventListener('click', () => markQuizResult(true));
    document.getElementById('markIncorrect')?.addEventListener('click', () => markQuizResult(false));
    
    // Quiz stroke width
    document.getElementById('quizStrokeSlider')?.addEventListener('input', (e) => {
        const width = parseInt(e.target.value);
        if (quizCanvas) quizCanvas.setStrokeWidth(width);
        document.getElementById('quizStrokeValue').textContent = width + 'px';
    });
    
    // Daily target
    document.getElementById('dailyTargetInput')?.addEventListener('change', (e) => {
        setDailyTarget(e.target.value);
    });
    
    // Sheet guide toggle
    document.getElementById('sheetShowGuide')?.addEventListener('change', (e) => {
        state.sheetShowGuide = e.target.checked;
        saveState(state);
        renderPracticeSheet();
    });
    
    // Review mode toggle
    document.querySelectorAll('.mode-btn[data-review-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn[data-review-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.reviewMode = btn.dataset.reviewMode;
            saveState(state);
            renderReviewChart();
        });
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        if (practiceCanvas) {
            practiceCanvas.setup();
            const lang = languages[state.currentLang];
            const charData = lang?.consonants[state.currentIndex];
            if (charData) {
                practiceCanvas.drawGuide(charData.char, lang.fontFamily, state.showGuide);
            }
            practiceCanvas.redraw();
        }
        if (quizCanvas && state.currentView === 'quiz') {
            quizCanvas.setup();
            quizCanvas.redraw();
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
