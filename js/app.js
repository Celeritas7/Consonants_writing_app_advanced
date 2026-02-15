// Multi-Script Practice App - Main JavaScript

import { languageData } from '../data/languages.js';

// ============================================================
// STATE
// ============================================================
let currentGroup = 'indic';
let currentLang = 'burmese';
let progress = {};      // { langId: { index: 'correct' | 'incorrect' } }
let drawings = {};      // { langId: { index: base64Data } }

// ============================================================
// INITIALIZATION
// ============================================================
function init() {
    loadData();
    setupHomePage();
    setupPracticePage();
}

function loadData() {
    try {
        const p = localStorage.getItem('msProgress');
        if (p) progress = JSON.parse(p);
        const d = localStorage.getItem('msDrawings');
        if (d) drawings = JSON.parse(d);
    } catch (e) {
        console.warn('Failed to load saved data:', e);
    }
}

function saveProgress() {
    try {
        localStorage.setItem('msProgress', JSON.stringify(progress));
    } catch (e) {
        console.warn('Failed to save progress:', e);
    }
}

function saveDrawings() {
    try {
        localStorage.setItem('msDrawings', JSON.stringify(drawings));
    } catch (e) {
        console.warn('Failed to save drawings:', e);
    }
}

// ============================================================
// PAGE NAVIGATION
// ============================================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    if (pageId === 'practicePage') {
        buildSheetGrid();
    }
}

// ============================================================
// HOMEPAGE SETUP
// ============================================================
function setupHomePage() {
    // Group selection (Indic / CJK)
    document.querySelectorAll('.group-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.group-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentGroup = card.dataset.group;
            
            // Show/hide language selections
            document.getElementById('indicLangs').classList.toggle('hidden', currentGroup !== 'indic');
            document.getElementById('cjkLangs').classList.toggle('hidden', currentGroup !== 'cjk');
            
            // Select first language of new group
            const firstLang = currentGroup === 'indic' ? 'burmese' : 'japanese_hiragana';
            selectLanguage(firstLang);
        });
    });

    // Language selection
    document.querySelectorAll('.lang-card').forEach(card => {
        card.addEventListener('click', () => {
            const parent = card.closest('.language-selection');
            parent.querySelectorAll('.lang-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentLang = card.dataset.lang;
            
            // Update card color
            const color = card.dataset.color || '#ef4444';
            card.style.background = color;
        });
    });

    // Start button
    document.getElementById('startBtn').addEventListener('click', () => {
        showPage('practicePage');
    });

    // Initialize first language selection color
    const firstCard = document.querySelector('.lang-card.active');
    if (firstCard) {
        firstCard.style.background = firstCard.dataset.color || '#ef4444';
    }
}

function selectLanguage(lang) {
    currentLang = lang;
    const container = currentGroup === 'indic' 
        ? document.getElementById('indicLangs') 
        : document.getElementById('cjkLangs');
    
    container.querySelectorAll('.lang-card').forEach(c => {
        const isActive = c.dataset.lang === lang;
        c.classList.toggle('active', isActive);
        if (isActive) {
            c.style.background = c.dataset.color || '#ef4444';
        } else {
            c.style.background = '';
        }
    });
}

// ============================================================
// PRACTICE PAGE SETUP
// ============================================================
function setupPracticePage() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        showPage('homePage');
    });

    // Clear all button
    document.getElementById('clearAllBtn').addEventListener('click', clearAllDrawings);

    // Print button
    document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
    });
}

// ============================================================
// SHEET GRID - Build the practice grid
// ============================================================
function buildSheetGrid() {
    const lang = languageData[currentLang];
    if (!lang) {
        console.error('Language not found:', currentLang);
        return;
    }

    const grid = document.getElementById('sheetGrid');
    
    // Update page title
    document.getElementById('pageTitle').innerHTML = `
        <span class="${lang.font}">${lang.name} ${lang.native}</span>
    `;

    // Build grid HTML
    let html = '';
    lang.chars.forEach((item, i) => {
        const status = progress[currentLang]?.[i] || '';
        const checkMark = status === 'correct' ? '✓' : status === 'incorrect' ? '✗' : '';
        
        html += `
            <div class="sheet-cell ${status}" data-index="${i}">
                <canvas class="cell-canvas" data-index="${i}"></canvas>
                <button class="cell-clear" data-index="${i}" title="Clear">✕</button>
                <div class="cell-checkbox ${status}" data-index="${i}">${checkMark}</div>
                <div class="cell-label">${item.label}</div>
            </div>
        `;
    });

    grid.innerHTML = html;

    // Setup each canvas after DOM is updated
    requestAnimationFrame(() => {
        grid.querySelectorAll('.cell-canvas').forEach(canvas => {
            const idx = parseInt(canvas.dataset.index);
            setupCellCanvas(canvas, idx);
        });

        // Checkbox click - cycle through states
        grid.querySelectorAll('.cell-checkbox').forEach(cb => {
            cb.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(cb.dataset.index);
                cycleStatus(idx);
            });
        });

        // Clear button for each cell
        grid.querySelectorAll('.cell-clear').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                clearCellDrawing(idx);
            });
        });
    });
}

// ============================================================
// CELL CANVAS - Setup drawing for each cell
// ============================================================
function setupCellCanvas(canvas, index) {
    const cell = canvas.parentElement;
    const rect = cell.getBoundingClientRect();
    const width = rect.width || 100;
    const height = (rect.height || 100) - 22; // Minus label height

    // Set canvas size (2x for retina displays)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Load saved drawing if exists
    if (drawings[currentLang]?.[index]) {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
        };
        img.src = drawings[currentLang][index];
    }

    // Drawing state
    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    function getPos(e) {
        const r = canvas.getBoundingClientRect();
        let clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: clientX - r.left,
            y: clientY - r.top
        };
    }

    function startDraw(e) {
        e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
        
        // Draw a dot for single taps
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a25';
        ctx.fill();
    }

    function doDraw(e) {
        if (!drawing) return;
        e.preventDefault();
        
        const pos = getPos(e);

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = '#1a1a25';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        lastX = pos.x;
        lastY = pos.y;
    }

    function endDraw(e) {
        if (drawing) {
            drawing = false;
            saveCellDrawing(index, canvas);
        }
    }

    // Mouse events
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', doDraw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);

    // Touch events
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', doDraw, { passive: false });
    canvas.addEventListener('touchend', endDraw);
    canvas.addEventListener('touchcancel', endDraw);
}

// ============================================================
// DRAWING PERSISTENCE
// ============================================================
function saveCellDrawing(index, canvas) {
    if (!drawings[currentLang]) {
        drawings[currentLang] = {};
    }
    drawings[currentLang][index] = canvas.toDataURL('image/png');
    saveDrawings();
}

function clearCellDrawing(index) {
    const canvas = document.querySelector(`.cell-canvas[data-index="${index}"]`);
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    
    if (drawings[currentLang]) {
        delete drawings[currentLang][index];
        saveDrawings();
    }
}

function clearAllDrawings() {
    const lang = languageData[currentLang];
    if (!lang) return;
    
    if (confirm(`Clear all drawings and ratings for ${lang.name}?`)) {
        drawings[currentLang] = {};
        progress[currentLang] = {};
        saveDrawings();
        saveProgress();
        buildSheetGrid();
    }
}

// ============================================================
// STATUS/RATING
// ============================================================
function cycleStatus(index) {
    if (!progress[currentLang]) {
        progress[currentLang] = {};
    }
    
    const current = progress[currentLang][index];

    if (!current) {
        progress[currentLang][index] = 'correct';
    } else if (current === 'correct') {
        progress[currentLang][index] = 'incorrect';
    } else {
        delete progress[currentLang][index];
    }

    saveProgress();
    
    // Update UI without rebuilding entire grid
    const cell = document.querySelector(`.sheet-cell[data-index="${index}"]`);
    const checkbox = document.querySelector(`.cell-checkbox[data-index="${index}"]`);
    
    if (cell && checkbox) {
        const newStatus = progress[currentLang][index] || '';
        
        cell.classList.remove('correct', 'incorrect');
        checkbox.classList.remove('correct', 'incorrect');
        
        if (newStatus) {
            cell.classList.add(newStatus);
            checkbox.classList.add(newStatus);
        }
        
        checkbox.textContent = newStatus === 'correct' ? '✓' : newStatus === 'incorrect' ? '✗' : '';
    }
}

// ============================================================
// WINDOW RESIZE HANDLING
// ============================================================
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (document.getElementById('practicePage').classList.contains('active')) {
            buildSheetGrid();
        }
    }, 300);
});

// ============================================================
// START APP
// ============================================================
document.addEventListener('DOMContentLoaded', init);
