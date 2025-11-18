// Global variables
let canvas, ctx;
let gameState = null;
let lastTime = 0;
let cheatMode = { P1: false, P2: false };

// Load bullet image
const bulletImage = new Image();
bulletImage.src = 'effects/bullet.png';

// Factory Functions

// Create a player object
function createPlayer(slot, name, character) {
    const x = slot === "P1" ? 200 : 650;
    const y = 240;
    
    return {
        name: name,
        slot: slot,
        character: character,
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        width: 40,
        height: 40,
        health: 100,
        gems: 0,
        score: 0,
        alive: true
    };
}

// Create a bullet object
function createBullet(ownerSlot, x, y) {
    return {
        x: x,
        y: y,
        vy: -400, // Move upward
        ownerSlot: ownerSlot,
        radius: 5
    };
}

// Initialize game when server sends gameStart
function initGame(serverData, mySlot) {
    console.log("Initializing game for", mySlot, serverData);
    
    // Get canvas and context
    canvas = document.getElementById("game-canvas");
    ctx = canvas.getContext("2d");
    
    // Build initial game state using factory functions
    const p1Data = serverData.players.find(p => p.slot === "P1");
    const p2Data = serverData.players.find(p => p.slot === "P2");
    
    gameState = {
        mySlot: mySlot,
        timeRemaining: serverData.duration, // 180 seconds
        players: {
            P1: createPlayer("P1", p1Data.name, p1Data.character),
            P2: createPlayer("P2", p2Data.name, p2Data.character)
        },
        asteroids: [],
        gems: [],
        bullets: [],
        lastSpawnAsteroid: 0,
        lastSpawnGem: 0,
        running: false, // Don't start until instructions are gone
        pressed: {},
        gameStartTime: serverData.duration
    };
    
    // Expose gameState to window for client.js access
    window.gameState = gameState;
    
    // Set up keyboard controls
    setupControls();
    
    // Listen for player input from other player
    window.gameSocket.on("playerInput", (data) => {
        if (gameState && data.slot !== gameState.mySlot) {
            const player = gameState.players[data.slot];
            if (player) {
                player.x = data.x;
                player.y = data.y;
            }
        }
    });
    
    // Listen for state updates from P1 (if we're P2)
    if (mySlot === "P2") {
        window.gameSocket.on("stateUpdate", receiveGameState);
    }
    
    // Start game loop
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Set up keyboard event listeners
function setupControls() {
    // Track pressed keys
    document.addEventListener("keydown", (e) => {
        gameState.pressed[e.code] = true;
        
        // Toggle cheat mode on Ctrl
        if (e.key === "Control") {
            cheatMode[gameState.mySlot] = !cheatMode[gameState.mySlot];
            console.log(`Cheat mode for ${gameState.mySlot}:`, cheatMode[gameState.mySlot]);
        }
        
        // Shooting controls
        if (gameState.mySlot === "P1" && e.code === "Space") {
            e.preventDefault();
            shoot("P1");
        }
        
        if (gameState.mySlot === "P2" && e.code === "Enter") {
            e.preventDefault();
            shoot("P2");
        }
    });
    
    document.addEventListener("keyup", (e) => {
        gameState.pressed[e.code] = false;
    });
}

// Main game loop
function gameLoop(timestamp) {
    if (!gameState) {
        return;
    }
    
    // Calculate delta time in seconds
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    
    // Only update and draw if game is running
    if (gameState.running) {
        update(dt);
        draw();
    } else {
        // Still draw the initial state even when paused
        draw();
    }
    
    // Continue loop regardless of running state
    requestAnimationFrame(gameLoop);
}

// Update game state
function update(dt) {
    // Only update game if running (after instructions disappear)
    if (gameState.running) {
        // Decrease time remaining
        gameState.timeRemaining -= dt;
        if (gameState.timeRemaining < 0) {
            gameState.timeRemaining = 0;
        }
        
        // Check if time ran out
        if (gameState.timeRemaining === 0 && gameState.players.P1.alive && gameState.players.P2.alive) {
            endGameByTime();
            return;
        }
    }
    
    // Only P1 updates game elements (authoritative)
    if (gameState.mySlot === "P1") {
        updatePlayers(dt);
        
        // Only spawn entities if game is running
        if (gameState.running) {
            spawnAsteroids(dt);
            spawnGems(dt);
            updateGems(dt);
            updateAsteroids(dt);
            updateBullets(dt);
            checkCollisions();
        }
        
        // Broadcast game state to P2
        broadcastGameState();
    } else {
        // P2 only updates local player input
        updatePlayers(dt);
    }
    
    updateHUD();
}

// Update player positions based on keyboard input
function updatePlayers(dt) {
    const speed = 200; // pixels per second
    
    Object.values(gameState.players).forEach(player => {
        if (!player.alive) return;
        
        // Reset velocity
        player.vx = 0;
        player.vy = 0;
        
        // Player 1 controls (WASD)
        if (player.slot === "P1" && gameState.mySlot === "P1") {
            if (gameState.pressed["KeyW"]) player.vy = -speed;
            if (gameState.pressed["KeyS"]) player.vy = speed;
            if (gameState.pressed["KeyA"]) player.vx = -speed;
            if (gameState.pressed["KeyD"]) player.vx = speed;
        }
        
        // Player 2 controls (Arrow keys)
        if (player.slot === "P2" && gameState.mySlot === "P2") {
            if (gameState.pressed["ArrowUp"]) player.vy = -speed;
            if (gameState.pressed["ArrowDown"]) player.vy = speed;
            if (gameState.pressed["ArrowLeft"]) player.vx = -speed;
            if (gameState.pressed["ArrowRight"]) player.vx = speed;
            
            // Debug logging
            if (player.vx !== 0 || player.vy !== 0) {
                console.log('P2 moving:', player.vx, player.vy, 'at', player.x, player.y);
            }
        }
        
        // Only update position if this is our player
        if (player.slot === gameState.mySlot) {
            // Update position
            player.x += player.vx * dt;
            player.y += player.vy * dt;
            
            // Clamp to canvas bounds
            player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
            player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));
            
            // Send position to other player
            if (window.gameSocket) {
                window.gameSocket.emit("playerInput", {
                    slot: player.slot,
                    x: player.x,
                    y: player.y
                });
            }
        }
    });
}

// Spawn asteroids (max 6 on screen)
function spawnAsteroids(dt) {
    gameState.lastSpawnAsteroid += dt;
    
    // Spawn every 1.5 seconds if under max count
    if (gameState.lastSpawnAsteroid >= 1.5 && gameState.asteroids.length < 6) {
        gameState.lastSpawnAsteroid = 0;
        gameState.asteroids.push(Asteroid(ctx, canvas.width));
    }
}

// Spawn gems (max 3 on screen)
function spawnGems(dt) {
    gameState.lastSpawnGem += dt;
    
    // Spawn every 4 seconds if under max count
    if (gameState.lastSpawnGem >= 4 && gameState.gems.length < 3) {
        gameState.lastSpawnGem = 0;
        const gem = Gem(ctx, 0, 0);
        gem.randomize(canvas.width, canvas.height);
        gameState.gems.push(gem);
    }
}

// Update gems (rotation animation)
function updateGems(dt) {
    gameState.gems.forEach(gem => {
        gem.update(dt);
    });
}

// Update asteroid positions
function updateAsteroids(dt) {
    // Update each asteroid
    gameState.asteroids.forEach(asteroid => {
        asteroid.update(dt, canvas.width);
    });
    
    // Remove off-screen asteroids
    gameState.asteroids = gameState.asteroids.filter(asteroid => 
        !asteroid.isOffScreen(canvas.height)
    );
}

// Update bullet positions
function updateBullets(dt) {
    const bulletSpeed = 300;
    
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const bullet = gameState.bullets[i];
        
        bullet.y += bullet.vy * dt;
        
        // Remove bullets that go off screen
        if (bullet.y < 0 || bullet.y > canvas.height) {
            gameState.bullets.splice(i, 1);
        }
    }
}

// Shoot a bullet
function shoot(slot) {
    if (!gameState || !gameState.running) return;
    
    const player = gameState.players[slot];
    if (!player.alive) return;
    
    const bullet = createBullet(slot, player.x, player.y - player.height / 2);
    gameState.bullets.push(bullet);
}

// Helper: Check if two circles overlap (for collision detection)
function circlesOverlap(x1, y1, r1, x2, y2, r2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < r1 + r2;
}

// Helper: Check if a point is inside a rectangle (AABB)
function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx - rw / 2 && px <= rx + rw / 2 &&
           py >= ry - rh / 2 && py <= ry + rh / 2;
}

// Check all collisions
function checkCollisions() {
    // Player <-> Gem collisions
    for (let i = gameState.gems.length - 1; i >= 0; i--) {
        const gem = gameState.gems[i];
        const { x: gemX, y: gemY } = gem.getXY();
        let collected = false;
        
        Object.values(gameState.players).forEach(player => {
            if (!player.alive || collected) return;
            
            // Check if gem center is inside player bounding box
            if (pointInRect(gemX, gemY, player.x, player.y, player.width, player.height)) {
                // Collect gem
                player.gems += 1;
                player.score += 10;
                gameState.gems.splice(i, 1);
                collected = true;
            }
        });
    }
    
    // Bullet <-> Asteroid collisions
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const bullet = gameState.bullets[i];
        let bulletHit = false;
        
        for (let j = gameState.asteroids.length - 1; j >= 0; j--) {
            const asteroid = gameState.asteroids[j];
            const bounds = asteroid.getBounds();
            
            if (circlesOverlap(bullet.x, bullet.y, bullet.radius, bounds.centerX, bounds.centerY, bounds.radius)) {
                // Destroy asteroid and bullet
                gameState.asteroids.splice(j, 1);
                gameState.bullets.splice(i, 1);
                
                // Award small score to shooter
                const shooter = gameState.players[bullet.ownerSlot];
                if (shooter) {
                    shooter.score += 5;
                }
                
                bulletHit = true;
                break;
            }
        }
        
        if (bulletHit) continue;
    }
    
    // Asteroid <-> Player collisions
    for (let i = gameState.asteroids.length - 1; i >= 0; i--) {
        const asteroid = gameState.asteroids[i];
        const bounds = asteroid.getBounds();
        let asteroidHit = false;
        
        Object.values(gameState.players).forEach(player => {
            if (!player.alive || asteroidHit) return;
            
            // Check circle-to-circle collision
            const playerRadius = Math.max(player.width, player.height) / 2;
            
            if (circlesOverlap(bounds.centerX, bounds.centerY, bounds.radius, player.x, player.y, playerRadius)) {
                // Collision detected
                if (!cheatMode[player.slot]) {
                    player.health -= 25;
                    
                    if (player.health <= 0) {
                        player.health = 0;
                        player.alive = false;
                        endGameByElimination(player.slot);
                    }
                }
                
                // Remove asteroid
                gameState.asteroids.splice(i, 1);
                asteroidHit = true;
            }
        });
    }
}

// Draw everything
function draw() {
    // Clear canvas (background image is set via CSS)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw gems
    gameState.gems.forEach(gem => {
        gem.draw();
    });
    
    // Draw asteroids
    gameState.asteroids.forEach(asteroid => {
        asteroid.draw();
    });
    
    // Draw bullets
    gameState.bullets.forEach(bullet => {
        if (bulletImage.complete && bulletImage.naturalWidth > 0) {
            // Draw bullet sprite
            const size = bullet.radius * 3; // Make it a bit bigger to see the image
            ctx.save();
            ctx.translate(bullet.x, bullet.y);
            ctx.drawImage(
                bulletImage,
                -size / 2,
                -size / 2,
                size,
                size
            );
            ctx.restore();
        } else {
            // Fallback: draw yellow circle
            ctx.fillStyle = "#ffff00";
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    
    // Draw players
    Object.values(gameState.players).forEach(player => {
        if (!player.alive) return;
        
        // Draw cheat mode shield if active
        if (cheatMode[player.slot]) {
            ctx.strokeStyle = "#0088ff";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.width / 2 + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.strokeStyle = "rgba(0, 136, 255, 0.3)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.width / 2 + 12, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw spaceship sprite
        if (typeof drawCharacterSprite === 'function') {
            drawCharacterSprite(ctx, player.character, player.x - player.width / 2, player.y - player.height / 2, player.width);
        } else {
            // Fallback: draw triangle if character sprite not loaded
            const color = player.slot === "P1" ? "#00ff00" : "#ff00ff";
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(player.x, player.y - player.height / 2);
            ctx.lineTo(player.x - player.width / 2, player.y + player.height / 2);
            ctx.lineTo(player.x + player.width / 2, player.y + player.height / 2);
            ctx.closePath();
            ctx.fill();
            
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Draw player name
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(player.name, player.x, player.y + player.height / 2 + 15);
    });
}

// Update HUD display
function updateHUD() {
    // Time
    const minutes = Math.floor(gameState.timeRemaining / 60);
    const seconds = Math.floor(gameState.timeRemaining % 60);
    document.getElementById("hud-time").textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    
    // Player 1
    document.getElementById("hud-p1-health").textContent = gameState.players.P1.health;
    document.getElementById("hud-p1-gems").textContent = gameState.players.P1.gems;
    document.getElementById("hud-p1-score").textContent = gameState.players.P1.score;
    
    const p1HealthBar = document.getElementById("hud-p1-health-bar");
    p1HealthBar.style.width = gameState.players.P1.health + "%";
    if (gameState.players.P1.health <= 25) {
        p1HealthBar.classList.add("low");
    } else {
        p1HealthBar.classList.remove("low");
    }
    
    // Player 2
    document.getElementById("hud-p2-health").textContent = gameState.players.P2.health;
    document.getElementById("hud-p2-gems").textContent = gameState.players.P2.gems;
    document.getElementById("hud-p2-score").textContent = gameState.players.P2.score;
    
    const p2HealthBar = document.getElementById("hud-p2-health-bar");
    p2HealthBar.style.width = gameState.players.P2.health + "%";
    if (gameState.players.P2.health <= 25) {
        p2HealthBar.classList.add("low");
    } else {
        p2HealthBar.classList.remove("low");
    }
}

// End game when a player is eliminated
function endGameByElimination(eliminatedSlot) {
    gameState.running = false;
    
    const winnerSlot = eliminatedSlot === "P1" ? "P2" : "P1";
    const eliminatedPlayer = gameState.players[eliminatedSlot];
    const winnerPlayer = gameState.players[winnerSlot];
    
    const timeElapsed = gameState.gameStartTime - gameState.timeRemaining;
    
    // Build summary object with detailed player stats
    const summary = {
        winner: winnerSlot,
        reason: "elimination",
        timeElapsed: timeElapsed,
        players: {
            P1: {
                name: gameState.players.P1.name,
                slot: "P1",
                score: gameState.players.P1.score,
                gems: gameState.players.P1.gems,
                health: gameState.players.P1.health,
                alive: gameState.players.P1.alive,
                status: gameState.players.P1.alive ? "WINNER" : `Eliminated at ${formatTime(timeElapsed)}`
            },
            P2: {
                name: gameState.players.P2.name,
                slot: "P2",
                score: gameState.players.P2.score,
                gems: gameState.players.P2.gems,
                health: gameState.players.P2.health,
                alive: gameState.players.P2.alive,
                status: gameState.players.P2.alive ? "WINNER" : `Eliminated at ${formatTime(timeElapsed)}`
            }
        }
    };
    
    console.log("Game ended by elimination:", summary);
    
    // Emit game over to server
    if (window.gameSocket) {
        window.gameSocket.emit("gameOver", summary);
    }
}

// End game when time runs out
function endGameByTime() {
    gameState.running = false;
    
    const p1Score = gameState.players.P1.score;
    const p2Score = gameState.players.P2.score;
    
    let winnerSlot;
    if (p1Score > p2Score) {
        winnerSlot = "P1";
    } else if (p2Score > p1Score) {
        winnerSlot = "P2";
    } else {
        winnerSlot = "DRAW";
    }
    
    const summary = {
        winner: winnerSlot,
        reason: "time",
        timeElapsed: gameState.gameStartTime,
        players: {
            P1: {
                name: gameState.players.P1.name,
                slot: "P1",
                score: gameState.players.P1.score,
                gems: gameState.players.P1.gems,
                health: gameState.players.P1.health,
                alive: gameState.players.P1.alive,
                status: winnerSlot === "P1" ? "WINNER" : (winnerSlot === "DRAW" ? "Survived" : "Survived")
            },
            P2: {
                name: gameState.players.P2.name,
                slot: "P2",
                score: gameState.players.P2.score,
                gems: gameState.players.P2.gems,
                health: gameState.players.P2.health,
                alive: gameState.players.P2.alive,
                status: winnerSlot === "P2" ? "WINNER" : (winnerSlot === "DRAW" ? "Survived" : "Survived")
            }
        }
    };
    
    console.log("Game ended by time:", summary);
    
    // Emit game over to server
    if (window.gameSocket) {
        window.gameSocket.emit("gameOver", summary);
    }
}

// Helper: Format time in M:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Broadcast game state from P1 to P2
function broadcastGameState() {
    if (!window.gameSocket || gameState.mySlot !== "P1") return;
    
    // Serialize game state for network transfer
    const state = {
        timeRemaining: gameState.timeRemaining,
        players: {
            P1: {
                x: gameState.players.P1.x,
                y: gameState.players.P1.y,
                health: gameState.players.P1.health,
                gems: gameState.players.P1.gems,
                score: gameState.players.P1.score,
                alive: gameState.players.P1.alive
            },
            P2: {
                x: gameState.players.P2.x,
                y: gameState.players.P2.y,
                health: gameState.players.P2.health,
                gems: gameState.players.P2.gems,
                score: gameState.players.P2.score,
                alive: gameState.players.P2.alive
            }
        },
        asteroids: gameState.asteroids.map(a => a.serialize()),
        gems: gameState.gems.map(g => {
            const pos = g.getXY();
            return { x: pos.x, y: pos.y, rotation: g.rotation };
        }),
        bullets: gameState.bullets.map(b => ({
            x: b.x,
            y: b.y,
            ownerSlot: b.ownerSlot
        }))
    };
    
    window.gameSocket.emit("stateUpdate", state);
}

// Receive game state from P1 (P2 only)
function receiveGameState(state) {
    if (!gameState || gameState.mySlot !== "P2") return;
    
    // Update time
    gameState.timeRemaining = state.timeRemaining;
    
    // Update P1 position and stats
    gameState.players.P1.x = state.players.P1.x;
    gameState.players.P1.y = state.players.P1.y;
    gameState.players.P1.health = state.players.P1.health;
    gameState.players.P1.gems = state.players.P1.gems;
    gameState.players.P1.score = state.players.P1.score;
    gameState.players.P1.alive = state.players.P1.alive;
    
    // Update P2 stats only (NOT position - we control that locally)
    gameState.players.P2.health = state.players.P2.health;
    gameState.players.P2.gems = state.players.P2.gems;
    gameState.players.P2.score = state.players.P2.score;
    gameState.players.P2.alive = state.players.P2.alive;
    
    // Update asteroids
    gameState.asteroids = state.asteroids.map(a => {
        const asteroid = Asteroid(ctx, canvas.width);
        asteroid.deserialize(a);
        return asteroid;
    });
    
    // Update gems
    gameState.gems = state.gems.map(g => {
        const gem = Gem(ctx, g.x, g.y);
        gem.rotation = g.rotation;
        gem.angle = g.rotation;
        return gem;
    });
    
    // Update bullets
    gameState.bullets = state.bullets.map(b => createBullet(b.ownerSlot, b.x, b.y));
}

// Show game over screen
function showGameOverScreen(summary) {
    console.log("Showing game over screen:", summary);
    
    // Get DOM elements
    const winnerText = document.getElementById("winner-text");
    const statsText = document.getElementById("stats-text");
    const rankingText = document.getElementById("ranking-text");
    
    // Update winner text
    if (summary.winner === "DRAW") {
        winnerText.textContent = "DRAW!";
    } else {
        const winnerNumber = summary.winner.charAt(1); // "P1" -> "1"
        winnerText.textContent = `PLAYER ${winnerNumber} WINS!`;
    }
    
    // Build player statistics
    const p1 = summary.players.P1;
    const p2 = summary.players.P2;
    
    // Clear existing stats
    statsText.innerHTML = '<h3 style="color: #00d4ff; margin-bottom: 20px;">Player Statistics</h3>';
    
    // Player 1 stats
    const p1StatLine = document.createElement("div");
    p1StatLine.className = "stat-line";
    p1StatLine.innerHTML = `
        <span class="stat-label">${p1.name} (P1):</span>
        <span class="stat-value">${p1.score} pts | ${p1.gems} gems | ${p1.status}</span>
    `;
    statsText.appendChild(p1StatLine);
    
    // Player 2 stats
    const p2StatLine = document.createElement("div");
    p2StatLine.className = "stat-line";
    p2StatLine.innerHTML = `
        <span class="stat-label">${p2.name} (P2):</span>
        <span class="stat-value">${p2.score} pts | ${p2.gems} gems | ${p2.status}</span>
    `;
    statsText.appendChild(p2StatLine);
    
    // Build ranking
    rankingText.innerHTML = '<h3>Player Ranking</h3>';
    
    if (summary.winner === "DRAW") {
        // Both players tied
        const drawLine = document.createElement("div");
        drawLine.className = "rank-line";
        drawLine.style.textAlign = "center";
        drawLine.innerHTML = `Both players tied with ${p1.score} pts`;
        rankingText.appendChild(drawLine);
    } else {
        // Determine winner and loser
        const winner = summary.players[summary.winner];
        const loserSlot = summary.winner === "P1" ? "P2" : "P1";
        const loser = summary.players[loserSlot];
        
        let winReason = "";
        if (summary.reason === "elimination") {
            winReason = "Survivor";
        } else {
            winReason = "Higher Score";
        }
        
        let loseReason = "";
        if (summary.reason === "elimination") {
            loseReason = "Eliminated";
        } else {
            loseReason = "Lower Score";
        }
        
        // First place
        const firstPlace = document.createElement("div");
        firstPlace.className = "rank-line rank-first";
        firstPlace.innerHTML = `1st – ${winner.name} (${winReason})`;
        rankingText.appendChild(firstPlace);
        
        // Second place
        const secondPlace = document.createElement("div");
        secondPlace.className = "rank-line rank-second";
        secondPlace.innerHTML = `2nd – ${loser.name} (${loseReason})`;
        rankingText.appendChild(secondPlace);
    }
}
