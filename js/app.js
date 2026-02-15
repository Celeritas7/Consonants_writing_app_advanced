// Main Application - Multi-Script Writing Practice
import { DrawingCanvas } from '../core/canvas.js';
import * as storage from '../core/storage.js';

// Import language groups
import * as indicGroup from '../groups/indic/index.js';
import * as cjkGroup from '../groups/cjk/index.js';

// ============================================================
// GLOBAL STATE
// ============================================================
const groups = {
    indic: indicGroup,
    cjk: cjkGroup
};

let currentGroup = 'indic';
let currentLanguage = null;
let currentData = [];
let currentIndex = 0;
let currentView = 'practice';
let practiceMode = 'sequential';
let quizMode = 'sequential';

// Canvas instances for all views
let practiceCanvas = null;
let quizCanvas = null;
let reviewCanvas = null;

// Quiz state
let quizStats = { correct: 0, incorrect: 0, streak: 0 };
let answerRevealed = false;
let sessionPracticed = [];

// Sheet state (NEW)
let sheetDrawings = {};  // { langId: { index: base64Data } }
let sheetProgress = {};  // { langId: { index: 'correct' | 'incorrect' } }

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const appState = storage.getAppState();
    currentGroup = appState.currentGroup || 'indic';
    currentView = appState.currentView || 'practice';
    currentIndex = appState.currentIndex || 0;
    practiceMode = appState.practiceMode || 'sequential';
    
    const savedLang = appState.currentLanguage;
    const groupLangs = groups[currentGroup].languages;
    currentLanguage = groupLangs[savedLang] || Object.values(groupLangs)[0];
    
    // Load sheet data
    loadSheetData();
    
    initGroupTabs();
    initLanguageTabs();
    initMainTabs();
    initModeToggles();
    initControls();
    loadDataForLanguage();
    
    setTimeout(() => {
        initAllCanvases();
        updateAllViews();
    }, 100);
});

// ============================================================
// SHEET DATA PERSISTENCE
// ============================================================
function loadSheetData() {
    try {
        const drawings = localStorage.getItem('sheet_drawings');
        if (drawings) sheetDrawings = JSON.parse(drawings);
        const progress = localStorage.getItem('sheet_progress');
        if (progress) sheetProgress = JSON.parse(progress);
    } catch (e) {
        console.warn('Error loading sheet data:', e);
    }
}

function saveSheetDrawings() {
    try {
        localStorage.setItem('sheet_drawings', JSON.stringify(sheetDrawings));
    } catch (e) {
        console.warn('Error saving drawings:', e);
    }
}

function saveSheetProgress() {
    try {
        localStorage.setItem('sheet_progress', JSON.stringify(sheetProgress));
    } catch (e) {
        console.warn('Error saving progress:', e);
    }
}

// ============================================================
// CANVAS INITIALIZATION - ALL VIEWS
// ============================================================
function initAllCanvases() {
    practiceCanvas = new DrawingCanvas('bgCanvas', 'drawCanvas', 'guideCanvas');
    quizCanvas = new DrawingCanvas('quizBgCanvas', 'quizDrawCanvas', 'quizGuideCanvas');
    reviewCanvas = new DrawingCanvas('reviewBgCanvas', 'reviewDrawCanvas', 'reviewGuideCanvas');
    
    const appState = storage.getAppState();
    const strokeWidth = appState.strokeWidth || 8;
    
    [practiceCanvas, quizCanvas, reviewCanvas].forEach(canvas => {
        if (canvas) canvas.setStrokeWidth(strokeWidth);
    });
    
    setupStrokeSlider('strokeSlider', 'strokeValue');
    setupStrokeSlider('quizStrokeSlider', 'quizStrokeValue');
}

function setupStrokeSlider(sliderId, valueId) {
    const slider = document.getElementById(sliderId);
    const valueEl = document.getElementById(valueId);
    if (!slider || !valueEl) return;
    
    const appState = storage.getAppState();
    slider.value = appState.strokeWidth || 8;
    valueEl.textContent = `${slider.value}px`;
    
    slider.addEventListener('input', () => {
        valueEl.textContent = `${slider.value}px`;
        const width = parseInt(slider.value);
        storage.saveAppState({ strokeWidth: width });
        [practiceCanvas, quizCanvas, reviewCanvas].forEach(c => {
            if (c) c.setStrokeWidth(width);
        });
    });
}

function reinitCurrentCanvas() {
    const canvasMap = {
        practice: practiceCanvas,
        quiz: quizCanvas,
        review: reviewCanvas
    };
    const canvas = canvasMap[currentView];
    if (canvas) canvas.reinit();
}

// ============================================================
// GROUP TABS
// ============================================================
function initGroupTabs() {
    const tabs = document.querySelectorAll('.group-tab');
    
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.group === currentGroup);
        
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentGroup = tab.dataset.group;
            storage.saveAppState({ currentGroup });
            
            const groupLangs = groups[currentGroup].languages;
            currentLanguage = Object.values(groupLangs)[0];
            storage.saveAppState({ currentLanguage: currentLanguage.id });
            
            currentIndex = 0;
            initLanguageTabs();
            loadDataForLanguage();
            updateAllViews();
        });
    });
}

// ============================================================
// LANGUAGE TABS
// ============================================================
function initLanguageTabs() {
    const container = document.getElementById('languageTabs');
    const groupLangs = groups[currentGroup].languages;
    
    let html = '';
    for (const [id, lang] of Object.entries(groupLangs)) {
        const isActive = currentLanguage && currentLanguage.id === id;
        html += `
            <button class="lang-tab ${isActive ? 'active' : ''}" data-lang="${id}">
                <span class="native ${lang.fontClass}">${lang.native}</span>
                <span>${lang.name}</span>
            </button>
        `;
    }
    
    container.innerHTML = html;
    
    container.querySelectorAll('.lang-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentLanguage = groups[currentGroup].languages[tab.dataset.lang];
            storage.saveAppState({ currentLanguage: tab.dataset.lang });
            
            currentIndex = 0;
            loadDataForLanguage();
            updateAllViews();
        });
    });
}

// ============================================================
// MAIN TABS
// ============================================================
function initMainTabs() {
    const tabs = document.querySelectorAll('.main-tab');
    const views = {
        practice: document.getElementById('practiceView'),
        quiz: document.getElementById('quizView'),
        sheet: document.getElementById('sheetView'),
        review: document.getElementById('reviewView')
    };
    
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.view === currentView));
    Object.entries(views).forEach(([key, view]) => view.classList.toggle('active', key === currentView));
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentView = tab.dataset.view;
            storage.saveAppState({ currentView });
            
            Object.values(views).forEach(v => v.classList.remove('active'));
            views[currentView].classList.add('active');
            
            setTimeout(() => {
                if (currentView === 'sheet') {
                    buildSheetCanvasGrid();
                } else {
                    reinitCurrentCanvas();
                }
                updateViewDisplay();
            }, 50);
        });
    });
}

// ============================================================
// MODE TOGGLES
// ============================================================
function initModeToggles() {
    document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === practiceMode);
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            practiceMode = btn.dataset.mode;
            storage.saveAppState({ practiceMode });
        });
    });
    
    document.querySelectorAll('.mode-btn[data-quiz-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn[data-quiz-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            quizMode = btn.dataset.quizMode;
        });
    });
    
    document.querySelectorAll('.mode-btn[data-review-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn[data-review-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateReviewGrid();
        });
    });
}

// ============================================================
// CONTROLS
// ============================================================
function initControls() {
    // Practice controls
    document.getElementById('prevBtn')?.addEventListener('click', () => navigate(-1));
    document.getElementById('nextBtn')?.addEventListener('click', () => navigate(1));
    document.getElementById('randomBtn')?.addEventListener('click', () => navigateRandom());
    document.getElementById('undoBtn')?.addEventListener('click', () => practiceCanvas?.undo());
    document.getElementById('clearBtn')?.addEventListener('click', () => practiceCanvas?.clear());
    document.getElementById('skipBtn')?.addEventListener('click', () => navigate(1));
    document.getElementById('markDoneBtn')?.addEventListener('click', () => markAsDone());
    
    // Guide toggle
    const showGuide = document.getElementById('showGuide');
    const appState = storage.getAppState();
    if (showGuide) {
        showGuide.checked = appState.showGuide !== false;
        showGuide.addEventListener('change', () => {
            storage.saveAppState({ showGuide: showGuide.checked });
            updateGuideCharacter();
        });
    }
    
    // Quiz controls
    document.getElementById('quizPrevBtn')?.addEventListener('click', () => quizNavigate(-1));
    document.getElementById('quizNextBtn')?.addEventListener('click', () => quizNavigate(1));
    document.getElementById('quizRandomBtn')?.addEventListener('click', () => quizNavigateRandom());
    document.getElementById('quizUndoBtn')?.addEventListener('click', () => quizCanvas?.undo());
    document.getElementById('quizClearBtn')?.addEventListener('click', () => quizCanvas?.clear());
    document.getElementById('quizSkipBtn')?.addEventListener('click', () => quizNavigate(1));
    document.getElementById('checkAnswerBtn')?.addEventListener('click', () => revealAnswer());
    document.getElementById('markCorrect')?.addEventListener('click', () => recordQuizResult(true));
    document.getElementById('markIncorrect')?.addEventListener('click', () => recordQuizResult(false));
    
    // Daily target
    const dailyTargetInput = document.getElementById('dailyTargetInput');
    if (dailyTargetInput) {
        dailyTargetInput.value = appState.dailyTarget || 10;
        document.getElementById('sessionTarget').textContent = dailyTargetInput.value;
        dailyTargetInput.addEventListener('change', () => {
            storage.saveAppState({ dailyTarget: parseInt(dailyTargetInput.value) });
            document.getElementById('sessionTarget').textContent = dailyTargetInput.value;
            updateSessionProgress();
        });
    }
    
    // Sheet controls (NEW)
    document.getElementById('sheetClearAllBtn')?.addEventListener('click', clearAllSheetCells);
    
    // Review controls
    document.getElementById('reviewUndoBtn')?.addEventListener('click', () => reviewCanvas?.undo());
    document.getElementById('reviewClearBtn')?.addEventListener('click', () => reviewCanvas?.clear());
}

// ============================================================
// DATA LOADING
// ============================================================
function loadDataForLanguage() {
    if (!currentLanguage) return;
    
    currentData = currentLanguage.consonants.map((c, i) => ({
        id: `${currentLanguage.id}_c_${i}`,
        char: c.char,
        roman: c.roman,
        devanagari: c.devanagari || '',
        meaning: c.meaning || '',
        index: i
    }));
    
    if (currentIndex >= currentData.length) {
        currentIndex = 0;
    }
}

// ============================================================
// UPDATE ALL VIEWS
// ============================================================
function updateAllViews() {
    updatePracticeDisplay();
    updateQuizDisplay();
    if (currentView === 'sheet') {
        buildSheetCanvasGrid();
    }
    updateReviewGrid();
    updateStats();
    updateCharGrid();
}

function updateViewDisplay() {
    switch (currentView) {
        case 'practice': updatePracticeDisplay(); break;
        case 'quiz': updateQuizDisplay(); break;
        case 'sheet': buildSheetCanvasGrid(); break;
        case 'review': updateReviewDisplay(); break;
    }
    updateCharGrid();
}

// ============================================================
// PRACTICE VIEW
// ============================================================
function updatePracticeDisplay() {
    if (currentData.length === 0) return;
    
    const item = currentData[currentIndex];
    
    const targetChar = document.getElementById('targetChar');
    targetChar.textContent = item.char;
    targetChar.className = `target-char ${currentLanguage.fontClass}`;
    
    const romanization = document.getElementById('romanization');
    if (item.devanagari && groups[currentGroup].groupInfo?.anchorType === 'devanagari') {
        romanization.textContent = item.devanagari;
        romanization.className = 'romanization devanagari';
    } else {
        romanization.textContent = item.roman;
        romanization.className = 'romanization';
    }
    
    document.getElementById('charDescription').textContent = 
        `${currentIndex + 1} of ${currentData.length}`;
    
    updateGuideCharacter();
    practiceCanvas?.clear();
}

function updateGuideCharacter() {
    const showGuide = document.getElementById('showGuide')?.checked;
    if (showGuide && currentData.length > 0 && practiceCanvas) {
        const item = currentData[currentIndex];
        practiceCanvas.drawGuideCharacter(item.char, currentLanguage.fontFamily);
    } else if (practiceCanvas) {
        practiceCanvas.hideGuide();
    }
}

// ============================================================
// QUIZ VIEW
// ============================================================
function updateQuizDisplay() {
    if (currentData.length === 0) return;
    
    const item = currentData[currentIndex];
    
    document.getElementById('quizRoman').textContent = item.roman;
    
    const quizDevanagari = document.getElementById('quizDevanagari');
    if (item.devanagari && groups[currentGroup].groupInfo?.anchorType === 'devanagari') {
        quizDevanagari.textContent = item.devanagari;
        quizDevanagari.className = 'quiz-prompt devanagari';
    } else {
        quizDevanagari.textContent = item.roman;
        quizDevanagari.className = 'quiz-prompt';
    }
    
    document.getElementById('quizDescription').textContent = `${currentIndex + 1} of ${currentData.length}`;
    
    const answerChar = document.getElementById('answerChar');
    answerChar.textContent = item.char;
    answerChar.className = `answer-char ${currentLanguage.fontClass}`;
    
    document.getElementById('answerReveal').classList.remove('visible');
    answerRevealed = false;
    
    document.getElementById('quizCorrect').textContent = quizStats.correct;
    document.getElementById('quizIncorrect').textContent = quizStats.incorrect;
    document.getElementById('quizStreak').textContent = quizStats.streak;
    
    quizCanvas?.clear();
}

function quizNavigate(direction) {
    if (quizMode === 'sequential') {
        currentIndex = (currentIndex + direction + currentData.length) % currentData.length;
    } else if (quizMode === 'mistakes') {
        const mistakes = storage.getMistakes(currentLanguage.id, 'consonant');
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
    storage.recordAttempt(currentLanguage.id, 'consonant', item.id, correct);
    
    if (correct) {
        quizStats.correct++;
        quizStats.streak++;
    } else {
        quizStats.incorrect++;
        quizStats.streak = 0;
    }
    
    if (!sessionPracticed.includes(item.id)) {
        sessionPracticed.push(item.id);
        updateSessionProgress();
    }
    
    updateStats();
    updateCharGrid();
    quizNavigate(1);
}

function updateSessionProgress() {
    const target = parseInt(document.getElementById('dailyTargetInput')?.value || 10);
    const count = sessionPracticed.length;
    const percent = Math.min(100, Math.round((count / target) * 100));
    
    document.getElementById('sessionCount').textContent = count;
    const progressBar = document.getElementById('sessionProgress');
    if (progressBar) progressBar.style.width = `${percent}%`;
}

// ============================================================
// SHEET VIEW - NEW: Blank Canvas Grid
// ============================================================
function buildSheetCanvasGrid() {
    if (!currentLanguage || currentData.length === 0) return;
    
    const grid = document.getElementById('sheetCanvasGrid');
    const langId = currentLanguage.id;
    
    let html = '';
    currentData.forEach((item, i) => {
        const status = sheetProgress[langId]?.[i] || '';
        const checkMark = status === 'correct' ? '✓' : status === 'incorrect' ? '✗' : '';
        const label = item.devanagari || item.roman;
        
        html += `
            <div class="sheet-canvas-cell ${status}" data-index="${i}">
                <canvas class="cell-canvas" data-index="${i}"></canvas>
                <button class="cell-clear" data-index="${i}" title="Clear">✕</button>
                <div class="cell-checkbox ${status}" data-index="${i}">${checkMark}</div>
                <div class="cell-label">${label}</div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
    
    // Setup each cell canvas after DOM is updated
    requestAnimationFrame(() => {
        grid.querySelectorAll('.cell-canvas').forEach(canvas => {
            setupSheetCellCanvas(canvas, parseInt(canvas.dataset.index));
        });
        
        // Checkbox clicks
        grid.querySelectorAll('.cell-checkbox').forEach(cb => {
            cb.addEventListener('click', (e) => {
                e.stopPropagation();
                cycleSheetCellStatus(parseInt(cb.dataset.index));
            });
        });
        
        // Clear buttons
        grid.querySelectorAll('.cell-clear').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                clearSheetCell(parseInt(btn.dataset.index));
            });
        });
    });
}

function setupSheetCellCanvas(canvas, index) {
    const cell = canvas.parentElement;
    const rect = cell.getBoundingClientRect();
    const width = rect.width || 80;
    const height = (rect.height || 80) - 24; // Minus label height
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    const langId = currentLanguage.id;
    
    // Load saved drawing
    if (sheetDrawings[langId]?.[index]) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, width, height);
        img.src = sheetDrawings[langId][index];
    }
    
    // Drawing events
    let drawing = false;
    let lx = 0, ly = 0;
    
    function getPos(e) {
        const r = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - r.left, y: clientY - r.top };
    }
    
    function start(e) {
        e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        lx = pos.x;
        ly = pos.y;
        
        // Draw dot for tap
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a25';
        ctx.fill();
    }
    
    function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = '#1a1a25';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        lx = pos.x;
        ly = pos.y;
    }
    
    function end() {
        if (drawing) {
            drawing = false;
            saveSheetCellDrawing(index, canvas);
        }
    }
    
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
}

function saveSheetCellDrawing(index, canvas) {
    const langId = currentLanguage.id;
    if (!sheetDrawings[langId]) sheetDrawings[langId] = {};
    sheetDrawings[langId][index] = canvas.toDataURL('image/png');
    saveSheetDrawings();
}

function clearSheetCell(index) {
    const canvas = document.querySelector(`.cell-canvas[data-index="${index}"]`);
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    
    const langId = currentLanguage.id;
    if (sheetDrawings[langId]) {
        delete sheetDrawings[langId][index];
        saveSheetDrawings();
    }
}

function cycleSheetCellStatus(index) {
    const langId = currentLanguage.id;
    if (!sheetProgress[langId]) sheetProgress[langId] = {};
    
    const current = sheetProgress[langId][index];
    
    if (!current) {
        sheetProgress[langId][index] = 'correct';
    } else if (current === 'correct') {
        sheetProgress[langId][index] = 'incorrect';
    } else {
        delete sheetProgress[langId][index];
    }
    
    saveSheetProgress();
    buildSheetCanvasGrid(); // Rebuild to update UI
}

function clearAllSheetCells() {
    if (!currentLanguage) return;
    
    if (confirm(`Clear all drawings for ${currentLanguage.name}?`)) {
        const langId = currentLanguage.id;
        sheetDrawings[langId] = {};
        sheetProgress[langId] = {};
        saveSheetDrawings();
        saveSheetProgress();
        buildSheetCanvasGrid();
    }
}

// ============================================================
// REVIEW VIEW
// ============================================================
function updateReviewDisplay() {
    updateReviewGrid();
}

function updateReviewGrid() {
    const grid = document.getElementById('reviewGrid');
    const progress = storage.getProgress(currentLanguage.id, 'consonant');
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
        
        const stats = `${data.correct}/${data.correct + data.incorrect}`;
        
        html += `
            <div class="review-cell ${strengthClass}" data-index="${item.index}">
                <div class="review-cell-char ${currentLanguage.fontClass}">${item.char}</div>
                <div class="review-cell-stats">${stats}</div>
            </div>
        `;
    }
    
    grid.innerHTML = html;
    
    grid.querySelectorAll('.review-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            grid.querySelectorAll('.review-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            
            const idx = parseInt(cell.dataset.index);
            currentIndex = idx;
            storage.saveAppState({ currentIndex });
            
            const item = currentData[idx];
            
            const charDisplay = document.getElementById('reviewCharDisplay');
            charDisplay.textContent = item.char;
            charDisplay.className = `review-char-display ${currentLanguage.fontClass}`;
            
            const label = item.devanagari ? `${item.devanagari} (${item.roman})` : item.roman;
            document.getElementById('reviewCharInfo').textContent = label;
            
            // Update review canvas guide
            if (reviewCanvas) {
                reviewCanvas.clear();
                reviewCanvas.drawGuideCharacter(item.char, currentLanguage.fontFamily);
            }
        });
    });
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(direction) {
    if (practiceMode === 'sequential') {
        currentIndex = (currentIndex + direction + currentData.length) % currentData.length;
    } else if (practiceMode === 'unpracticed') {
        const progress = storage.getProgress(currentLanguage.id, 'consonant');
        const unpracticed = currentData.filter(item => !progress[item.id]?.practiced);
        if (unpracticed.length > 0) {
            const randomItem = unpracticed[Math.floor(Math.random() * unpracticed.length)];
            currentIndex = randomItem.index;
        } else {
            currentIndex = (currentIndex + direction + currentData.length) % currentData.length;
        }
    } else {
        navigateRandom();
        return;
    }
    storage.saveAppState({ currentIndex });
    updatePracticeDisplay();
    updateCharGrid();
}

function navigateRandom() {
    currentIndex = Math.floor(Math.random() * currentData.length);
    storage.saveAppState({ currentIndex });
    updatePracticeDisplay();
    updateCharGrid();
}

function markAsDone() {
    if (currentData.length === 0) return;
    
    const item = currentData[currentIndex];
    storage.markPracticed(currentLanguage.id, 'consonant', item.id);
    
    if (!sessionPracticed.includes(item.id)) {
        sessionPracticed.push(item.id);
        updateSessionProgress();
    }
    
    updateStats();
    updateCharGrid();
    navigate(1);
}

// ============================================================
// STATS & GRID
// ============================================================
function updateStats() {
    const progress = storage.getProgress(currentLanguage.id, 'consonant');
    const total = currentData.length;
    const practiced = Object.values(progress).filter(p => p.practiced).length;
    const percent = total > 0 ? Math.round((practiced / total) * 100) : 0;
    
    document.getElementById('practicedCount').textContent = practiced;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('progressPercent').textContent = `${percent}%`;
}

function updateCharGrid() {
    const grids = [document.getElementById('charGrid'), document.getElementById('quizCharGrid')];
    const progress = storage.getProgress(currentLanguage.id, 'consonant');
    
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
        
        html += `<div class="${classes}" data-index="${item.index}" title="${item.roman}">${item.char}</div>`;
    }
    
    grids.forEach(grid => {
        if (!grid) return;
        grid.innerHTML = html;
        
        grid.querySelectorAll('.char-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                currentIndex = parseInt(cell.dataset.index);
                storage.saveAppState({ currentIndex });
                updateViewDisplay();
                updateCharGrid();
            });
        });
    });
}
