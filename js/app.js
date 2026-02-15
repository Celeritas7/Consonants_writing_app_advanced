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
let currentTab = 'practice';
let practiceMode = 'sequential';
let reviewMode = 'last5';

// Canvas instances
let practiceCanvas = null;
let quizCanvas = null;

// Quiz state
let quizStats = { correct: 0, incorrect: 0, streak: 0 };

// Sheet state
let sheetDrawings = {};  // { langId: { index: base64Data } }
let sheetProgress = {};  // { langId: { index: 'correct' | 'incorrect' } }
let sheetShowGuide = false;  // Toggle for showing guide in sheet cells

// Drawing state for canvases
let strokes = [];
let currentStroke = [];
let isDrawing = false;
let lastX = 0, lastY = 0;

// ============================================================
// INITIALIZATION
// ============================================================
function init() {
    loadSheetData();
    setupHomePage();
    setupPracticePage();
    
    // Set initial language
    const groupLangs = groups[currentGroup].languages;
    currentLanguage = Object.values(groupLangs)[0];
    loadDataForLanguage();
}

function loadSheetData() {
    try {
        const d = localStorage.getItem('sheetDrawings');
        if (d) sheetDrawings = JSON.parse(d);
        const p = localStorage.getItem('sheetProgress');
        if (p) sheetProgress = JSON.parse(p);
        const g = localStorage.getItem('sheetShowGuide');
        if (g) sheetShowGuide = JSON.parse(g);
    } catch (e) {
        console.warn('Error loading sheet data:', e);
    }
}

function saveSheetDrawings() {
    try { localStorage.setItem('sheetDrawings', JSON.stringify(sheetDrawings)); } catch (e) {}
}

function saveSheetProgress() {
    try { localStorage.setItem('sheetProgress', JSON.stringify(sheetProgress)); } catch (e) {}
}

function saveSheetGuideState() {
    try { localStorage.setItem('sheetShowGuide', JSON.stringify(sheetShowGuide)); } catch (e) {}
}

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
    if (currentIndex >= currentData.length) currentIndex = 0;
}

// ============================================================
// PAGE NAVIGATION
// ============================================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    if (pageId === 'practicePage') {
        updatePageTitle();
        showTab(currentTab);
    }
}

function showTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.view === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Initialize tab content
    setTimeout(() => {
        if (tabName === 'practice') {
            setupPracticeCanvas();
            updatePracticeDisplay();
        } else if (tabName === 'quiz') {
            setupQuizCanvas();
            updateQuizDisplay();
        } else if (tabName === 'sheet') {
            buildSheetGrid();
        } else if (tabName === 'review') {
            updateReviewDisplay();
        }
    }, 50);
}

function updatePageTitle() {
    const title = document.getElementById('pageTitle');
    title.innerHTML = `<span class="${currentLanguage.fontClass}">${currentLanguage.name} ${currentLanguage.native}</span>`;
}

// ============================================================
// HOMEPAGE
// ============================================================
function setupHomePage() {
    // Group selection
    document.querySelectorAll('.group-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.group-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentGroup = card.dataset.group;
            
            document.getElementById('indicLangs').classList.toggle('hidden', currentGroup !== 'indic');
            document.getElementById('cjkLangs').classList.toggle('hidden', currentGroup !== 'cjk');
            
            // Select first language in group
            const container = currentGroup === 'indic' ? document.getElementById('indicLangs') : document.getElementById('cjkLangs');
            container.querySelectorAll('.lang-card').forEach((c, i) => {
                c.classList.toggle('active', i === 0);
                c.style.background = i === 0 ? c.dataset.color : '';
            });
            
            const firstLangId = container.querySelector('.lang-card').dataset.lang;
            currentLanguage = groups[currentGroup].languages[firstLangId];
            loadDataForLanguage();
        });
    });

    // Language selection
    document.querySelectorAll('.lang-card').forEach(card => {
        card.addEventListener('click', () => {
            const parent = card.closest('.language-selection');
            parent.querySelectorAll('.lang-card').forEach(c => {
                c.classList.remove('active');
                c.style.background = '';
            });
            card.classList.add('active');
            card.style.background = card.dataset.color;
            
            currentLanguage = groups[currentGroup].languages[card.dataset.lang];
            loadDataForLanguage();
        });
    });

    // Initialize first language color
    const firstCard = document.querySelector('.lang-card.active');
    if (firstCard) firstCard.style.background = firstCard.dataset.color;

    // Start button
    document.getElementById('startBtn').addEventListener('click', () => {
        currentIndex = 0;
        showPage('practicePage');
    });
}

// ============================================================
// PRACTICE PAGE SETUP
// ============================================================
function setupPracticePage() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => showPage('homePage'));

    // Tab switching
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.view));
    });

    // Practice tab controls
    document.getElementById('practicePrevBtn').addEventListener('click', () => navigate(-1, 'practice'));
    document.getElementById('practiceNextBtn').addEventListener('click', () => navigate(1, 'practice'));
    document.getElementById('practiceUndoBtn').addEventListener('click', () => undo('practice'));
    document.getElementById('practiceClearBtn').addEventListener('click', () => clearCanvas('practice'));
    document.getElementById('practiceSkipBtn').addEventListener('click', () => navigate(1, 'practice'));
    document.getElementById('practiceDoneBtn').addEventListener('click', () => {
        markPracticed();
        navigate(1, 'practice');
    });
    
    document.getElementById('practiceStrokeSlider').addEventListener('input', e => {
        document.getElementById('practiceStrokeValue').textContent = e.target.value + 'px';
        if (practiceCanvas) practiceCanvas.setStrokeWidth(parseInt(e.target.value));
    });
    
    document.getElementById('practiceGuideToggle').addEventListener('change', () => {
        drawPracticeGuide();
    });

    // Practice mode buttons
    document.querySelectorAll('.pmode-btn[data-pmode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pmode-btn[data-pmode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            practiceMode = btn.dataset.pmode;
            if (practiceMode === 'random') navigateRandom('practice');
            else if (practiceMode === 'unpracticed') navigateUnpracticed();
        });
    });

    // Quiz tab controls
    document.getElementById('quizPrevBtn').addEventListener('click', () => navigate(-1, 'quiz'));
    document.getElementById('quizNextBtn').addEventListener('click', () => navigate(1, 'quiz'));
    document.getElementById('quizUndoBtn').addEventListener('click', () => undo('quiz'));
    document.getElementById('quizClearBtn').addEventListener('click', () => clearCanvas('quiz'));
    document.getElementById('quizSkipBtn').addEventListener('click', () => { hideQuizAnswer(); navigate(1, 'quiz'); });
    document.getElementById('quizCheckBtn').addEventListener('click', showQuizAnswer);
    document.getElementById('quizCorrectBtn').addEventListener('click', () => recordQuizResult(true));
    document.getElementById('quizWrongBtn').addEventListener('click', () => recordQuizResult(false));

    // Sheet tab controls
    document.getElementById('sheetClearAllBtn').addEventListener('click', clearAllSheetCells);
    document.getElementById('sheetPrintBtn').addEventListener('click', () => window.print());
    
    // SHEET GUIDE TOGGLE
    const sheetGuideToggle = document.getElementById('sheetGuideToggle');
    sheetGuideToggle.checked = sheetShowGuide;
    sheetGuideToggle.addEventListener('change', () => {
        sheetShowGuide = sheetGuideToggle.checked;
        saveSheetGuideState();
        updateSheetGuides();
    });

    // Review tab controls
    document.querySelectorAll('.pmode-btn[data-rmode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pmode-btn[data-rmode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            reviewMode = btn.dataset.rmode;
            updateReviewDisplay();
        });
    });
    document.getElementById('resetProgressBtn').addEventListener('click', resetProgress);
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(dir, view) {
    currentIndex = (currentIndex + dir + currentData.length) % currentData.length;
    
    if (view === 'practice') {
        clearCanvas('practice');
        updatePracticeDisplay();
    } else if (view === 'quiz') {
        clearCanvas('quiz');
        hideQuizAnswer();
        updateQuizDisplay();
    }
}

function navigateRandom(view) {
    currentIndex = Math.floor(Math.random() * currentData.length);
    if (view === 'practice') {
        clearCanvas('practice');
        updatePracticeDisplay();
    }
}

function navigateUnpracticed() {
    const progress = storage.getProgress(currentLanguage.id, 'consonant');
    const unpracticed = currentData.filter(item => !progress[item.id]?.practiced);
    if (unpracticed.length > 0) {
        currentIndex = unpracticed[0].index;
    }
    clearCanvas('practice');
    updatePracticeDisplay();
}

function markPracticed() {
    if (currentData.length === 0) return;
    const item = currentData[currentIndex];
    storage.markPracticed(currentLanguage.id, 'consonant', item.id);
}

// ============================================================
// PRACTICE TAB
// ============================================================
function updatePracticeDisplay() {
    if (currentData.length === 0) return;
    const item = currentData[currentIndex];
    
    const mainChar = document.getElementById('practiceMainChar');
    mainChar.textContent = item.char;
    mainChar.className = 'main-char ' + currentLanguage.fontClass;
    
    const labelEl = document.getElementById('practiceCharLabel');
    labelEl.textContent = item.devanagari || item.roman;
    labelEl.className = item.devanagari ? 'char-label devanagari' : 'char-label';
    
    document.getElementById('practiceCharRoman').textContent = `(${item.roman})`;
    document.getElementById('practiceCurrentNum').textContent = currentIndex + 1;
    document.getElementById('practiceTotalNum').textContent = currentData.length;
    
    drawPracticeGuide();
}

function setupPracticeCanvas() {
    const container = document.getElementById('practiceCanvasContainer');
    if (!container) return;
    const size = Math.min(container.offsetWidth, 400);
    
    ['bgCanvas', 'guideCanvas', 'drawCanvas'].forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            canvas.width = size;
            canvas.height = size;
        }
    });
    
    practiceCanvas = new DrawingCanvas('bgCanvas', 'drawCanvas', 'guideCanvas');
    strokes = [];
}

function drawPracticeGuide() {
    const showGuide = document.getElementById('practiceGuideToggle')?.checked;
    if (showGuide && currentData.length > 0 && practiceCanvas) {
        const item = currentData[currentIndex];
        practiceCanvas.drawGuideCharacter(item.char, currentLanguage.fontFamily);
    } else if (practiceCanvas) {
        practiceCanvas.hideGuide();
    }
}

// ============================================================
// QUIZ TAB
// ============================================================
function updateQuizDisplay() {
    if (currentData.length === 0) return;
    const item = currentData[currentIndex];
    
    const promptEl = document.getElementById('quizPromptChar');
    promptEl.textContent = item.devanagari || item.roman;
    promptEl.className = item.devanagari ? 'prompt-char devanagari' : 'prompt-char';
    
    document.getElementById('quizCharRoman').textContent = `(${item.roman})`;
    
    const answerEl = document.getElementById('quizAnswerChar');
    answerEl.textContent = item.char;
    answerEl.className = 'answer-char ' + currentLanguage.fontClass;
    
    document.getElementById('quizCurrentNum').textContent = currentIndex + 1;
    document.getElementById('quizTotalNum').textContent = currentData.length;
    
    document.getElementById('quizCorrectCount').textContent = quizStats.correct;
    document.getElementById('quizIncorrectCount').textContent = quizStats.incorrect;
    document.getElementById('quizStreakCount').textContent = quizStats.streak;
}

function setupQuizCanvas() {
    const container = document.getElementById('quizCanvasContainer');
    if (!container) return;
    const size = Math.min(container.offsetWidth, 400);
    
    ['quizBgCanvas', 'quizDrawCanvas'].forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            canvas.width = size;
            canvas.height = size;
        }
    });
    
    quizCanvas = new DrawingCanvas('quizBgCanvas', 'quizDrawCanvas');
    strokes = [];
}

function showQuizAnswer() {
    document.getElementById('quizAnswerSection').classList.add('visible');
}

function hideQuizAnswer() {
    document.getElementById('quizAnswerSection').classList.remove('visible');
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
    
    hideQuizAnswer();
    navigate(1, 'quiz');
}

// ============================================================
// SHEET TAB - Blank Canvas Grid with Guide Toggle
// ============================================================
function buildSheetGrid() {
    if (!currentLanguage || currentData.length === 0) return;
    
    const grid = document.getElementById('sheetCanvasGrid');
    const langId = currentLanguage.id;
    
    // Update guide toggle state
    document.getElementById('sheetGuideToggle').checked = sheetShowGuide;
    
    let html = '';
    currentData.forEach((item, i) => {
        const status = sheetProgress[langId]?.[i] || '';
        const checkMark = status === 'correct' ? '✓' : status === 'incorrect' ? '✗' : '';
        const label = item.devanagari || item.roman;
        const guideClass = sheetShowGuide ? '' : 'hidden';
        
        html += `
            <div class="sheet-canvas-cell ${status}" data-index="${i}">
                <div class="cell-guide ${guideClass} ${currentLanguage.fontClass}" data-index="${i}">${item.char}</div>
                <canvas class="cell-canvas" data-index="${i}"></canvas>
                <button class="cell-clear" data-index="${i}" title="Clear">✕</button>
                <div class="cell-checkbox ${status}" data-index="${i}">${checkMark}</div>
                <div class="cell-label">${label}</div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
    
    // Setup each cell canvas
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

function updateSheetGuides() {
    // Show/hide all guide characters based on toggle
    document.querySelectorAll('.cell-guide').forEach(guide => {
        guide.classList.toggle('hidden', !sheetShowGuide);
    });
}

function setupSheetCellCanvas(canvas, index) {
    const cell = canvas.parentElement;
    const rect = cell.getBoundingClientRect();
    const width = rect.width || 100;
    const height = (rect.height || 100) - 28; // Minus label height
    
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
    buildSheetGrid();
}

function clearAllSheetCells() {
    if (!currentLanguage) return;
    
    if (confirm(`Clear all drawings for ${currentLanguage.name}?`)) {
        const langId = currentLanguage.id;
        sheetDrawings[langId] = {};
        sheetProgress[langId] = {};
        saveSheetDrawings();
        saveSheetProgress();
        buildSheetGrid();
    }
}

// ============================================================
// REVIEW TAB
// ============================================================
function updateReviewDisplay() {
    if (!currentLanguage || currentData.length === 0) return;
    
    const grid = document.getElementById('reviewGrid');
    const progress = storage.getProgress(currentLanguage.id, 'consonant');
    
    let correctCount = 0, incorrectCount = 0;
    
    let html = '';
    currentData.forEach((item, i) => {
        const data = progress[item.id] || { correct: 0, incorrect: 0, attempts: [] };
        
        let score = 0;
        if (reviewMode === 'last5' && data.attempts?.length > 0) {
            const last5 = data.attempts.slice(-5);
            const correct = last5.filter(a => a.correct).length;
            score = (correct / last5.length) * 100;
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
            
            correctCount += data.correct;
            incorrectCount += data.incorrect;
        }
        
        const statusText = data.correct + data.incorrect > 0 ? `${data.correct}/${data.correct + data.incorrect}` : '';
        
        html += `
            <div class="review-cell ${strengthClass}" data-index="${i}">
                <div class="cell-char ${currentLanguage.fontClass}">${item.char}</div>
                <div class="cell-status">${statusText}</div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
    
    // Update stats
    document.getElementById('reviewCorrectCount').textContent = correctCount;
    document.getElementById('reviewIncorrectCount').textContent = incorrectCount;
    document.getElementById('reviewTotalCount').textContent = currentData.length;
    
    const practiced = Object.values(progress).filter(p => p.practiced || p.correct > 0 || p.incorrect > 0).length;
    const percent = currentData.length > 0 ? Math.round((practiced / currentData.length) * 100) : 0;
    document.getElementById('reviewProgressPercent').textContent = percent + '%';
    
    // Click to go to practice
    grid.querySelectorAll('.review-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            currentIndex = parseInt(cell.dataset.index);
            showTab('practice');
        });
    });
}

function resetProgress() {
    if (!currentLanguage) return;
    if (confirm(`Reset all progress for ${currentLanguage.name}?`)) {
        // Clear from storage module
        const key = `multi_script_progress_${currentLanguage.id}_consonant`;
        localStorage.removeItem(key);
        updateReviewDisplay();
    }
}

// ============================================================
// CANVAS UTILITIES
// ============================================================
function undo(view) {
    if (view === 'practice' && practiceCanvas) {
        practiceCanvas.undo();
    } else if (view === 'quiz' && quizCanvas) {
        quizCanvas.undo();
    }
}

function clearCanvas(view) {
    if (view === 'practice' && practiceCanvas) {
        practiceCanvas.clear();
    } else if (view === 'quiz' && quizCanvas) {
        quizCanvas.clear();
    }
}

// ============================================================
// WINDOW RESIZE
// ============================================================
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (document.getElementById('practicePage').classList.contains('active')) {
            if (currentTab === 'practice') setupPracticeCanvas();
            else if (currentTab === 'quiz') setupQuizCanvas();
            else if (currentTab === 'sheet') buildSheetGrid();
        }
    }, 250);
});

// ============================================================
// START APP
// ============================================================
document.addEventListener('DOMContentLoaded', init);
