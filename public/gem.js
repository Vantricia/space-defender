/**
 * Gem factory function
 * Creates a gem object with sprite rendering
 * Similar to gem.js pattern from gem_rush
 */

// Load gem sprite image (shared across all gems)
const gemImage = new Image();
gemImage.src = 'effects/gem.jpeg';

const gemCollectSound = new Audio('effects/collect.mp3');
gemCollectSound.volume = 0.3;

function playGemCollectSound() {
    gemCollectSound.currentTime = 0;
    gemCollectSound.play();
}

/**
 * Gem factory function
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Initial x position
 * @param {number} y - Initial y position
 * @returns {Object} Gem object with draw and randomize methods
 */
const Gem = function(ctx, x, y) {
    const gem = {
        x: x,
        y: y,
        radius: 15,
        angle: 0,
        rotation: 0  // Exposed for synchronization
    };

    /**
     * Get current position
     */
    gem.getXY = function() {
        return { x: this.x, y: this.y };
    };

    /**
     * Set position
     */
    gem.setXY = function(newX, newY) {
        this.x = newX;
        this.y = newY;
    };

    /**
     * Randomize gem position within canvas bounds
     */
    gem.randomize = function(canvasWidth, canvasHeight) {
        const padding = 40;
        this.x = padding + Math.random() * (canvasWidth - padding * 2);
        this.y = padding + Math.random() * (canvasHeight - padding * 2);
    };

    /**
     * Update gem (rotation animation)
     */
    gem.update = function(dt) {
        this.angle += dt * 2; // Rotate over time
        this.rotation = this.angle;  // Keep rotation in sync
    };

    /**
     * Draw the gem
     */
    gem.draw = function() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (gemImage.complete && gemImage.naturalWidth !== 0) {
            // Draw gem sprite
            const size = this.radius * 2;
            ctx.drawImage(
                gemImage,
                -this.radius, -this.radius,
                size, size
            );
        } else {
            // Fallback: draw diamond shape if image not loaded
            ctx.fillStyle = "#00ffff";
            ctx.beginPath();
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(this.radius, 0);
            ctx.lineTo(0, this.radius);
            ctx.lineTo(-this.radius, 0);
            ctx.closePath();
            ctx.fill();

            // Glow effect
            ctx.strokeStyle = "#00ffff";
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    };

    return gem;
};
