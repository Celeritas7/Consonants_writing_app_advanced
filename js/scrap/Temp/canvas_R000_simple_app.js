// Canvas Module - Handles all drawing operations

export class DrawingCanvas {
    constructor(bgCanvasId, guideCanvasId, drawCanvasId) {
        this.bgCanvas = document.getElementById(bgCanvasId);
        this.guideCanvas = guideCanvasId ? document.getElementById(guideCanvasId) : null;
        this.drawCanvas = document.getElementById(drawCanvasId);
        
        if (!this.bgCanvas || !this.drawCanvas) {
            console.warn('Canvas elements not found:', bgCanvasId, drawCanvasId);
            return;
        }
        
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.guideCtx = this.guideCanvas ? this.guideCanvas.getContext('2d') : null;
        this.drawCtx = this.drawCanvas.getContext('2d');
        
        this.strokes = [];
        this.currentStroke = [];
        this.isDrawing = false;
        this.strokeWidth = 8;
        this.strokeColor = '#1a1a25';
        
        this.setupEventListeners();
    }
    
    setup() {
        if (!this.bgCanvas) return;
        
        const container = this.bgCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) || 400;
        
        const canvases = [this.bgCanvas, this.drawCanvas];
        if (this.guideCanvas) canvases.push(this.guideCanvas);
        
        canvases.forEach(canvas => {
            canvas.width = size;
            canvas.height = size;
        });
        
        this.drawBackground();
    }
    
    drawBackground() {
        if (!this.bgCtx) return;
        
        const size = this.bgCanvas.width;
        this.bgCtx.fillStyle = '#fefefe';
        this.bgCtx.fillRect(0, 0, size, size);
        
        // Draw grid lines
        this.bgCtx.strokeStyle = '#e0e0e0';
        this.bgCtx.lineWidth = 1;
        
        // Cross lines
        this.bgCtx.beginPath();
        this.bgCtx.moveTo(size / 2, 0);
        this.bgCtx.lineTo(size / 2, size);
        this.bgCtx.moveTo(0, size / 2);
        this.bgCtx.lineTo(size, size / 2);
        this.bgCtx.stroke();
        
        // Diagonal lines
        this.bgCtx.strokeStyle = '#f0f0f0';
        this.bgCtx.setLineDash([5, 5]);
        this.bgCtx.beginPath();
        this.bgCtx.moveTo(0, 0);
        this.bgCtx.lineTo(size, size);
        this.bgCtx.moveTo(size, 0);
        this.bgCtx.lineTo(0, size);
        this.bgCtx.stroke();
        this.bgCtx.setLineDash([]);
    }
    
    drawGuide(char, fontFamily, show = true) {
        if (!this.guideCtx) return;
        
        const size = this.guideCanvas.width;
        this.guideCtx.clearRect(0, 0, size, size);
        
        if (show && char) {
            this.guideCtx.font = `${size * 0.6}px ${fontFamily}`;
            this.guideCtx.fillStyle = 'rgba(200, 200, 200, 0.3)';
            this.guideCtx.textAlign = 'center';
            this.guideCtx.textBaseline = 'middle';
            this.guideCtx.fillText(char, size / 2, size / 2);
        }
    }
    
    setupEventListeners() {
        if (!this.drawCanvas) return;
        
        // Mouse events
        this.drawCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.drawCanvas.addEventListener('mousemove', (e) => this.draw(e));
        this.drawCanvas.addEventListener('mouseup', () => this.stopDrawing());
        this.drawCanvas.addEventListener('mouseleave', () => this.stopDrawing());
        
        // Touch events
        this.drawCanvas.addEventListener('touchstart', (e) => this.handleTouch(e, 'start'));
        this.drawCanvas.addEventListener('touchmove', (e) => this.handleTouch(e, 'move'));
        this.drawCanvas.addEventListener('touchend', () => this.stopDrawing());
    }
    
    getPos(e) {
        const rect = this.drawCanvas.getBoundingClientRect();
        const scaleX = this.drawCanvas.width / rect.width;
        const scaleY = this.drawCanvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getPos(e);
        this.currentStroke = [pos];
        
        this.drawCtx.beginPath();
        this.drawCtx.moveTo(pos.x, pos.y);
        this.drawCtx.strokeStyle = this.strokeColor;
        this.drawCtx.lineWidth = this.strokeWidth;
        this.drawCtx.lineCap = 'round';
        this.drawCtx.lineJoin = 'round';
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getPos(e);
        this.currentStroke.push(pos);
        
        this.drawCtx.lineTo(pos.x, pos.y);
        this.drawCtx.stroke();
        this.drawCtx.beginPath();
        this.drawCtx.moveTo(pos.x, pos.y);
    }
    
    stopDrawing() {
        if (this.isDrawing && this.currentStroke.length > 0) {
            this.strokes.push({ points: this.currentStroke, width: this.strokeWidth });
        }
        this.isDrawing = false;
        this.currentStroke = [];
    }
    
    handleTouch(e, type) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
        
        if (type === 'start') {
            this.startDrawing(mouseEvent);
        } else if (type === 'move') {
            this.draw(mouseEvent);
        }
    }
    
    clear() {
        this.strokes = [];
        if (this.drawCtx) {
            this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
        }
    }
    
    undo() {
        if (this.strokes.length > 0) {
            this.strokes.pop();
            this.redraw();
        }
    }
    
    redraw() {
        if (!this.drawCtx) return;
        
        this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
        
        this.strokes.forEach(stroke => {
            if (stroke.points.length > 0) {
                this.drawCtx.beginPath();
                this.drawCtx.strokeStyle = this.strokeColor;
                this.drawCtx.lineWidth = stroke.width;
                this.drawCtx.lineCap = 'round';
                this.drawCtx.lineJoin = 'round';
                this.drawCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
                stroke.points.forEach(p => this.drawCtx.lineTo(p.x, p.y));
                this.drawCtx.stroke();
            }
        });
    }
    
    setStrokeWidth(width) {
        this.strokeWidth = width;
    }
}
