// Drawing Canvas Module - Works across all views
export class DrawingCanvas {
    constructor(bgCanvasId, drawCanvasId, guideCanvasId = null) {
        this.bgCanvas = document.getElementById(bgCanvasId);
        this.drawCanvas = document.getElementById(drawCanvasId);
        this.guideCanvas = guideCanvasId ? document.getElementById(guideCanvasId) : null;
        
        if (!this.bgCanvas || !this.drawCanvas) {
            console.error('Canvas elements not found:', bgCanvasId, drawCanvasId);
            return;
        }
        
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.drawCtx = this.drawCanvas.getContext('2d');
        this.guideCtx = this.guideCanvas ? this.guideCanvas.getContext('2d') : null;
        
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.strokeWidth = 8;
        this.strokeColor = '#1a1a25';
        this.strokes = [];
        this.currentStroke = [];
        
        this.initialized = false;
        this.init();
    }
    
    init() {
        if (this.initialized) return;
        this.setupCanvas();
        this.bindEvents();
        this.drawBackground();
        this.initialized = true;
    }
    
    setupCanvas() {
        const container = this.bgCanvas.parentElement;
        if (!container) return;
        
        const size = Math.min(container.offsetWidth || 400, 400);
        
        [this.bgCanvas, this.drawCanvas, this.guideCanvas].forEach(canvas => {
            if (canvas) {
                canvas.width = size;
                canvas.height = size;
                canvas.style.width = size + 'px';
                canvas.style.height = size + 'px';
            }
        });
        
        this.drawBackground();
    }
    
    bindEvents() {
        // Mouse events
        this.drawCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.drawCanvas.addEventListener('mousemove', (e) => this.draw(e));
        this.drawCanvas.addEventListener('mouseup', () => this.stopDrawing());
        this.drawCanvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events for mobile
        this.drawCanvas.addEventListener('touchstart', (e) => this.handleTouch(e, 'start'), { passive: false });
        this.drawCanvas.addEventListener('touchmove', (e) => this.handleTouch(e, 'move'), { passive: false });
        this.drawCanvas.addEventListener('touchend', () => this.stopDrawing());
        this.drawCanvas.addEventListener('touchcancel', () => this.stopDrawing());
        
        // Resize handler with debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.setupCanvas(), 100);
        });
    }
    
    handleTouch(e, type) {
        e.preventDefault();
        e.stopPropagation();
        
        const touch = e.touches[0];
        const rect = this.drawCanvas.getBoundingClientRect();
        const scaleX = this.drawCanvas.width / rect.width;
        const scaleY = this.drawCanvas.height / rect.height;
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;
        
        if (type === 'start') {
            this.startDrawing({ offsetX: x, offsetY: y });
        } else if (type === 'move') {
            this.draw({ offsetX: x, offsetY: y });
        }
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.drawCanvas.getBoundingClientRect();
        const scaleX = this.drawCanvas.width / rect.width;
        const scaleY = this.drawCanvas.height / rect.height;
        
        // Handle both mouse and touch
        let x, y;
        if (e.offsetX !== undefined) {
            x = e.offsetX * scaleX;
            y = e.offsetY * scaleY;
        } else {
            x = e.offsetX;
            y = e.offsetY;
        }
        
        this.lastX = x;
        this.lastY = y;
        this.currentStroke = [{ x: this.lastX, y: this.lastY }];
        
        // Draw a dot for single clicks
        this.drawCtx.beginPath();
        this.drawCtx.arc(this.lastX, this.lastY, this.strokeWidth / 2, 0, Math.PI * 2);
        this.drawCtx.fillStyle = this.strokeColor;
        this.drawCtx.fill();
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.drawCanvas.getBoundingClientRect();
        const scaleX = this.drawCanvas.width / rect.width;
        const scaleY = this.drawCanvas.height / rect.height;
        
        let x, y;
        if (e.offsetX !== undefined) {
            x = e.offsetX * scaleX;
            y = e.offsetY * scaleY;
        } else {
            x = e.offsetX;
            y = e.offsetY;
        }
        
        this.drawCtx.beginPath();
        this.drawCtx.moveTo(this.lastX, this.lastY);
        this.drawCtx.lineTo(x, y);
        this.drawCtx.strokeStyle = this.strokeColor;
        this.drawCtx.lineWidth = this.strokeWidth;
        this.drawCtx.lineCap = 'round';
        this.drawCtx.lineJoin = 'round';
        this.drawCtx.stroke();
        
        this.currentStroke.push({ x, y });
        this.lastX = x;
        this.lastY = y;
    }
    
    stopDrawing() {
        if (this.isDrawing && this.currentStroke.length > 0) {
            this.strokes.push([...this.currentStroke]);
        }
        this.isDrawing = false;
        this.currentStroke = [];
    }
    
    drawBackground() {
        const size = this.bgCanvas.width;
        if (size === 0) return;
        
        this.bgCtx.fillStyle = '#fefefe';
        this.bgCtx.fillRect(0, 0, size, size);
        
        // Draw grid lines
        this.bgCtx.strokeStyle = '#e0e0e0';
        this.bgCtx.lineWidth = 1;
        
        // Vertical center line
        this.bgCtx.beginPath();
        this.bgCtx.moveTo(size / 2, 0);
        this.bgCtx.lineTo(size / 2, size);
        this.bgCtx.stroke();
        
        // Horizontal center line
        this.bgCtx.beginPath();
        this.bgCtx.moveTo(0, size / 2);
        this.bgCtx.lineTo(size, size / 2);
        this.bgCtx.stroke();
        
        // Diagonal lines
        this.bgCtx.strokeStyle = '#f0f0f0';
        this.bgCtx.setLineDash([5, 5]);
        
        this.bgCtx.beginPath();
        this.bgCtx.moveTo(0, 0);
        this.bgCtx.lineTo(size, size);
        this.bgCtx.stroke();
        
        this.bgCtx.beginPath();
        this.bgCtx.moveTo(size, 0);
        this.bgCtx.lineTo(0, size);
        this.bgCtx.stroke();
        
        this.bgCtx.setLineDash([]);
    }
    
    drawGuideCharacter(char, fontFamily = 'Noto Sans Myanmar') {
        if (!this.guideCtx) return;
        
        const size = this.guideCanvas.width;
        if (size === 0) return;
        
        this.guideCtx.clearRect(0, 0, size, size);
        
        // Calculate font size based on character length
        let fontSize = size * 0.6;
        if (char.length > 1) {
            fontSize = size * 0.5 / Math.max(1, char.length * 0.35);
        }
        
        this.guideCtx.font = `${fontSize}px "${fontFamily}"`;
        this.guideCtx.fillStyle = 'rgba(200, 200, 200, 0.4)';
        this.guideCtx.textAlign = 'center';
        this.guideCtx.textBaseline = 'middle';
        this.guideCtx.fillText(char, size / 2, size / 2);
    }
    
    hideGuide() {
        if (!this.guideCtx) return;
        const size = this.guideCanvas.width;
        this.guideCtx.clearRect(0, 0, size, size);
    }
    
    showGuide(char, fontFamily) {
        this.drawGuideCharacter(char, fontFamily);
    }
    
    clear() {
        const size = this.drawCanvas.width;
        this.drawCtx.clearRect(0, 0, size, size);
        this.strokes = [];
    }
    
    undo() {
        if (this.strokes.length === 0) return;
        this.strokes.pop();
        this.redrawAllStrokes();
    }
    
    redrawAllStrokes() {
        const size = this.drawCanvas.width;
        this.drawCtx.clearRect(0, 0, size, size);
        
        for (const stroke of this.strokes) {
            if (stroke.length === 0) continue;
            
            this.drawCtx.beginPath();
            this.drawCtx.arc(stroke[0].x, stroke[0].y, this.strokeWidth / 2, 0, Math.PI * 2);
            this.drawCtx.fillStyle = this.strokeColor;
            this.drawCtx.fill();
            
            if (stroke.length > 1) {
                this.drawCtx.beginPath();
                this.drawCtx.moveTo(stroke[0].x, stroke[0].y);
                
                for (let i = 1; i < stroke.length; i++) {
                    this.drawCtx.lineTo(stroke[i].x, stroke[i].y);
                }
                
                this.drawCtx.strokeStyle = this.strokeColor;
                this.drawCtx.lineWidth = this.strokeWidth;
                this.drawCtx.lineCap = 'round';
                this.drawCtx.lineJoin = 'round';
                this.drawCtx.stroke();
            }
        }
    }
    
    setStrokeWidth(width) {
        this.strokeWidth = width;
    }
    
    hasContent() {
        return this.strokes.length > 0;
    }
    
    // Reinitialize canvas (useful when view becomes visible)
    reinit() {
        this.setupCanvas();
        this.drawBackground();
        this.redrawAllStrokes();
    }
}
