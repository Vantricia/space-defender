// Global variables
let canvas, ctx;
let gameState = null;
let lastTime = 0;
let cheatMode = { P1: false, P2: false };

// Factory Functions

// Create a player object
function createPlayer(slot, name) {
    const x = slot === "P1" ? 200 : 650;
    const y = 240;
    
    return {
        name: name,
        slot: slot,
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

// Create an asteroid object
function createAsteroid() {
    return {
        x: Math.random() * canvas.width,
        y: -30, // Start above the canvas
        vx: (Math.random() - 0.5) * 100, // Random horizontal drift
        vy: 50 + Math.random() * 100, // Downward velocity
        radius: 20
    };
}

// Create a gem object
function createGem() {
    const padding = 40;
    return {
        x: padding + Math.random() * (canvas.width - padding * 2),
        y: padding + Math.random() * (canvas.height - padding * 2),
        radius: 15,
        angle: 0
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
            P1: createPlayer("P1", p1Data.name),
            P2: createPlayer("P2", p2Data.name)
        },
        asteroids: [],
        gems: [],
        bullets: [],
        lastSpawnAsteroid: 0,
        lastSpawnGem: 0,
        running: true,
        pressed: {},
        gameStartTime: serverData.duration
    };
    
    // Set up keyboard controls
    setupControls();
    
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
    if (!gameState || !gameState.running) {
        return;
    }
    
    // Calculate delta time in seconds
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    
    // Update and draw
    update(dt);
    draw();
    
    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Update game state
function update(dt) {
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
    
    // Update game elements
    updatePlayers(dt);
    spawnAsteroids(dt);
    spawnGems(dt);
    updateAsteroids(dt);
    updateBullets(dt);
    checkCollisions();
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
        if (player.slot === "P1") {
            if (gameState.pressed["KeyW"]) player.vy = -speed;
            if (gameState.pressed["KeyS"]) player.vy = speed;
            if (gameState.pressed["KeyA"]) player.vx = -speed;
            if (gameState.pressed["KeyD"]) player.vx = speed;
        }
        
        // Player 2 controls (Arrow keys)
        if (player.slot === "P2") {
            if (gameState.pressed["ArrowUp"]) player.vy = -speed;
            if (gameState.pressed["ArrowDown"]) player.vy = speed;
            if (gameState.pressed["ArrowLeft"]) player.vx = -speed;
            if (gameState.pressed["ArrowRight"]) player.vx = speed;
        }
        
        // Update position
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        
        // Clamp to canvas bounds
        player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
        player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));
    });
}

// Spawn asteroids (max 6 on screen)
function spawnAsteroids(dt) {
    gameState.lastSpawnAsteroid += dt;
    
    // Spawn every 1.5 seconds if under max count
    if (gameState.lastSpawnAsteroid >= 1.5 && gameState.asteroids.length < 6) {
        gameState.lastSpawnAsteroid = 0;
        gameState.asteroids.push(createAsteroid());
    }
}

// Spawn gems (max 3 on screen)
function spawnGems(dt) {
    gameState.lastSpawnGem += dt;
    
    // Spawn every 4 seconds if under max count
    if (gameState.lastSpawnGem >= 4 && gameState.gems.length < 3) {
        gameState.lastSpawnGem = 0;
        gameState.gems.push(createGem());
    }
}

// Update asteroid positions
function updateAsteroids(dt) {
    for (let i = gameState.asteroids.length - 1; i >= 0; i--) {
        const asteroid = gameState.asteroids[i];
        
        asteroid.x += asteroid.vx * dt;
        asteroid.y += asteroid.vy * dt;
        
        // Remove asteroids that go off the bottom of the screen
        if (asteroid.y > canvas.height + asteroid.radius) {
            gameState.asteroids.splice(i, 1);
        }
        
        // Wrap horizontally
        if (asteroid.x < -asteroid.radius) asteroid.x = canvas.width + asteroid.radius;
        if (asteroid.x > canvas.width + asteroid.radius) asteroid.x = -asteroid.radius;
    }
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
        let collected = false;
        
        Object.values(gameState.players).forEach(player => {
            if (!player.alive || collected) return;
            
            // Check if gem center is inside player bounding box
            if (pointInRect(gem.x, gem.y, player.x, player.y, player.width, player.height)) {
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
            
            if (circlesOverlap(bullet.x, bullet.y, bullet.radius, asteroid.x, asteroid.y, asteroid.radius)) {
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
        let asteroidHit = false;
        
        Object.values(gameState.players).forEach(player => {
            if (!player.alive || asteroidHit) return;
            
            // Check circle-to-rectangle collision
            // Use player center and treat as circle for simplicity
            const playerRadius = Math.max(player.width, player.height) / 2;
            
            if (circlesOverlap(asteroid.x, asteroid.y, asteroid.radius, player.x, player.y, playerRadius)) {
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
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw space background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw stars (simple dots)
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 50; i++) {
        const x = (i * 137) % canvas.width;
        const y = (i * 211) % canvas.height;
        ctx.fillRect(x, y, 2, 2);
    }
    
    // Draw gems
    gameState.gems.forEach(gem => {
        gem.angle += 0.05;
        
        ctx.save();
        ctx.translate(gem.x, gem.y);
        ctx.rotate(gem.angle);
        
        // Draw diamond shape
        ctx.fillStyle = "#00ffff";
        ctx.beginPath();
        ctx.moveTo(0, -gem.radius);
        ctx.lineTo(gem.radius, 0);
        ctx.lineTo(0, gem.radius);
        ctx.lineTo(-gem.radius, 0);
        ctx.closePath();
        ctx.fill();
        
        // Glow effect
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    });
    
    // Draw asteroids
    gameState.asteroids.forEach(asteroid => {
        ctx.fillStyle = "#8B4513";
        ctx.beginPath();
        ctx.arc(asteroid.x, asteroid.y, asteroid.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "#654321";
        ctx.lineWidth = 2;
        ctx.stroke();
    });
    
    // Draw bullets
    gameState.bullets.forEach(bullet => {
        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
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
        
        // Draw spaceship (triangle pointing up)
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
