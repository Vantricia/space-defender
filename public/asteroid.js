/**
 * Asteroid factory function
 * Creates an asteroid object with sprite rendering and movement
 * Similar to gem.js pattern from gem_rush
 */

// Load asteroid sprite sheet (shared across all asteroids)
const asteroidSheet = new Image();
asteroidSheet.src = 'effects/asteroids.png';

const asteroidCrashSound = new Audio('effects/asteroid_crash.wav');
asteroidCrashSound.volume = 0.5;

function playAsteroidCrashSound() {
    asteroidCrashSound.currentTime = 0;
    asteroidCrashSound.play();
}

// Asteroid sprite sheet configuration (8x8 grid = 64 asteroids)
const ASTEROID_SPRITE_SIZE = 128; // Each asteroid is 128x128 in sprite sheet
const ASTEROID_SHEET_COLS = 8;
const ASTEROID_SHEET_ROWS = 8;

/**
 * Asteroid factory function
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} canvasWidth - Canvas width for spawning
 * @returns {Object} Asteroid object with update and draw methods
 */
const Asteroid = function(ctx, canvasWidth) {
    // Random asteroid sprite from sheet (0-63)
    const spriteIndex = Math.floor(Math.random() * 64);
    const spriteCol = spriteIndex % ASTEROID_SHEET_COLS;
    const spriteRow = Math.floor(spriteIndex / ASTEROID_SHEET_COLS);

    // Random spawn position and velocity
    const asteroid = {
        x: Math.random() * (canvasWidth - 80) + 40,
        y: -30,
        vx: (Math.random() - 0.5) * 50, // Horizontal drift
        vy: Math.random() * 30 + 50,     // Downward speed
        radius: 20,
        spriteCol: spriteCol,
        spriteRow: spriteRow
    };

    /**
     * Get axis-aligned bounding box
     */
    asteroid.getBounds = function() {
        return {
            left: this.x - this.radius,
            right: this.x + this.radius,
            top: this.y - this.radius,
            bottom: this.y + this.radius,
            centerX: this.x,
            centerY: this.y,
            radius: this.radius
        };
    };

    /**
     * Update asteroid position
     * @param {number} dt - Delta time in seconds
     * @param {number} canvasWidth - Canvas width for wrapping
     */
    asteroid.update = function(dt, canvasWidth) {
        // Move asteroid
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Wrap horizontally
        if (this.x < -this.radius) {
            this.x = canvasWidth + this.radius;
        } else if (this.x > canvasWidth + this.radius) {
            this.x = -this.radius;
        }
    };

    /**
     * Check if asteroid is off screen (bottom)
     * @param {number} canvasHeight - Canvas height
     */
    asteroid.isOffScreen = function(canvasHeight) {
        return this.y - this.radius > canvasHeight;
    };

    /**
     * Draw the asteroid
     */
    asteroid.draw = function() {
        // Check if image is loaded and ready
        if (asteroidSheet.complete && asteroidSheet.naturalWidth !== 0) {
            // Calculate sprite sheet source position
            const sx = this.spriteCol * ASTEROID_SPRITE_SIZE;
            const sy = this.spriteRow * ASTEROID_SPRITE_SIZE;
            const drawSize = this.radius * 2;

            // Draw asteroid sprite from sheet
            ctx.drawImage(
                asteroidSheet,
                sx, sy, 
                ASTEROID_SPRITE_SIZE, ASTEROID_SPRITE_SIZE,
                this.x - this.radius, this.y - this.radius,
                drawSize, drawSize
            );
        } else {
            // Fallback: draw simple circle if sprite not loaded
            ctx.fillStyle = "#8B4513";
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#654321";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    };

    /**
     * Serialize asteroid state for network transfer
     */
    asteroid.serialize = function() {
        return {
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            radius: this.radius,
            spriteCol: this.spriteCol,
            spriteRow: this.spriteRow
        };
    };

    /**
     * Restore asteroid state from serialized data
     */
    asteroid.deserialize = function(data) {
        this.x = data.x;
        this.y = data.y;
        this.vx = data.vx;
        this.vy = data.vy;
        this.radius = data.radius;
        this.spriteCol = data.spriteCol;
        this.spriteRow = data.spriteRow;
    };

    return asteroid;
};
