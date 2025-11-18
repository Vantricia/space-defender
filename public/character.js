/**
 * Character selection module
 * Handles spaceship sprite selection with 6 variations
 */

// Load character sprite sheet
const characterSheet = new Image();
characterSheet.src = 'effects/characters.png';

// Character sprite configuration (3 columns x 2 rows = 6 spaceships)
const CHARACTER_COLS = 3;
const CHARACTER_ROWS = 2;
const CHARACTER_COUNT = 6;

// Selected characters state
let myCharacter = null;
let selectedCharacters = new Set(); // Track which characters are taken

/**
 * Initialize character selection UI
 */
function initCharacterSelection() {
    const characterOptions = document.querySelectorAll('.character-option');
    
    // Wait for character sheet to load
    characterSheet.onload = () => {
        console.log('[CHARACTER] Sprite sheet loaded', characterSheet.width, 'x', characterSheet.height);
        const spriteWidth = characterSheet.width / CHARACTER_COLS;
        const spriteHeight = characterSheet.height / CHARACTER_ROWS;
        
        console.log('Sprite dimensions:', spriteWidth, 'x', spriteHeight);
        
        // Draw each character on a canvas inside the option
        characterOptions.forEach((option, index) => {
            const col = index % CHARACTER_COLS;
            const row = Math.floor(index / CHARACTER_COLS);
            const sx = col * spriteWidth;
            const sy = row * spriteHeight;
            
            // Create canvas for this character
            const canvas = document.createElement('canvas');
            canvas.width = 80;
            canvas.height = 80;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'none';
            
            const ctx = canvas.getContext('2d');
            
            // Draw character sprite
            ctx.drawImage(
                characterSheet,
                sx, sy,
                spriteWidth, spriteHeight,
                0, 0,
                80, 80
            );
            
            // Clear any existing content and add canvas
            option.innerHTML = '';
            option.appendChild(canvas);
        });
    };
    
    // Trigger load if already cached
    if (characterSheet.complete && characterSheet.naturalWidth > 0) {
        characterSheet.onload();
    }
    
    // Add click handlers
    characterOptions.forEach((option) => {
        option.addEventListener('click', function() {
            if (this.classList.contains('disabled')) return;
            
            const characterIndex = parseInt(this.dataset.character);
            
            // Remove previous selection
            characterOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Select this character
            this.classList.add('selected');
            myCharacter = characterIndex;
            
            console.log('Selected character:', characterIndex);
        });
    });
}

/**
 * Update character availability based on lobby state
 * @param {Array} players - Array of {slot, name, character} objects
 */
function updateCharacterAvailability(players) {
    selectedCharacters.clear();
    
    // Mark characters as taken
    players.forEach(player => {
        if (player.character !== undefined && player.character !== null) {
            selectedCharacters.add(player.character);
        }
    });
    
    // Update UI
    const characterOptions = document.querySelectorAll('.character-option');
    characterOptions.forEach((option) => {
        const characterIndex = parseInt(option.dataset.character);
        
        if (selectedCharacters.has(characterIndex) && myCharacter !== characterIndex) {
            option.classList.add('disabled');
            option.classList.remove('selected');
        } else {
            option.classList.remove('disabled');
        }
    });
}

/**
 * Draw a character sprite on a canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} characterIndex - Character index (0-5)
 * @param {number} x - X position (top-left corner)
 * @param {number} y - Y position (top-left corner)
 * @param {number} size - Size to draw (both width and height)
 */
function drawCharacterSprite(ctx, characterIndex, x, y, size) {
    if (!characterSheet.complete) return;
    
    const spriteWidth = characterSheet.width / CHARACTER_COLS;
    const spriteHeight = characterSheet.height / CHARACTER_ROWS;
    
    const col = characterIndex % CHARACTER_COLS;
    const row = Math.floor(characterIndex / CHARACTER_COLS);
    
    const sx = col * spriteWidth;
    const sy = row * spriteHeight;
    
    ctx.drawImage(
        characterSheet,
        sx, sy,
        spriteWidth, spriteHeight,
        x, y,
        size, size
    );
}

/**
 * Get selected character index
 */
function getSelectedCharacter() {
    return myCharacter;
}

// Export functions
window.initCharacterSelection = initCharacterSelection;
window.updateCharacterAvailability = updateCharacterAvailability;
window.drawCharacterSprite = drawCharacterSprite;
window.getSelectedCharacter = getSelectedCharacter;
