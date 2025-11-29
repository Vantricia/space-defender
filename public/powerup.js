// PowerUp sprite - bottom 2 rows of icons-pow-up.svg
const powerUpImage = new Image();
powerUpImage.src = 'effects/icons-pow-up.svg';

// PowerUp types from 3rd row only of SVG (3 icons total)
const POWERUP_TYPES = {
    BULLET: { name: 'bullet', row: 2, col: 0, effect: 'triple-shot' },   // 3rd row, 1st col - Triple shot
    WRENCH: { name: 'wrench', row: 2, col: 1, effect: 'shield' },        // 3rd row, 2nd col - Shield
    LIGHTNING: { name: 'lightning', row: 2, col: 2, effect: 'speed' }    // 3rd row, 3rd col - Speed
};

// Convert to array for random selection
const POWERUP_LIST = [
    POWERUP_TYPES.BULLET,
    POWERUP_TYPES.WRENCH,
    POWERUP_TYPES.LIGHTNING
];

// PowerUp class
function createPowerUp(x, y, type) {
    return {
        x: x,
        y: y,
        type: type, // One of POWERUP_TYPES
        width: 40,
        height: 40,
        vy: 100, // Fall speed (pixels/sec)
        radius: 20,
        
        update: function(dt) {
            this.y += this.vy * dt;
        },
        
        draw: function() {
            if (powerUpImage.complete && powerUpImage.naturalWidth > 0) {
                // SVG has 3 columns, 4 rows total (224x312 px)
                // Using 3rd row only (row index 2 in 0-indexed)
                const svgRow = this.type.row; // Already set to 2 for 3rd row
                const svgCol = this.type.col;
                
                const spriteWidth = 224 / 3;  // SVG width is 224px, 3 columns = ~74.67px
                const spriteHeight = 312 / 4; // SVG height is 312px, 4 rows = 78px
                
                // Minimal padding to capture full icon with no gap at top
                const topPadding = 0;
                const sidePadding = 2;
                const bottomPadding = 15;
                
                const sx = svgCol * spriteWidth + sidePadding;
                const sy = svgRow * spriteHeight + topPadding;
                const sw = spriteWidth - sidePadding * 2;
                const sh = spriteHeight - topPadding - bottomPadding;
                
                ctx.save();
                ctx.drawImage(
                    powerUpImage,
                    sx, sy, sw, sh,
                    this.x - this.width / 2,
                    this.y - this.height / 2,
                    this.width,
                    this.height
                );
                ctx.restore();
            } else {
                // Fallback: draw colored circle
                const colors = {
                    'wrench': '#FFD700',
                    'lightning': '#9E005D',
                    'bullet': '#999999'
                };
                ctx.fillStyle = colors[this.type.name] || '#ffffff';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        },
        
        isOffScreen: function() {
            return this.y - this.height / 2 > 480; // Canvas height
        }
    };
}
