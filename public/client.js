// Connect to socket.io server
const socket = io();

// Track local player info
let mySlot = null;
let myName = null;

// Helper function to show a specific screen
function showScreen(id) {
    // Hide all screens
    const screens = document.querySelectorAll(".screen");
    screens.forEach(screen => screen.classList.remove("active"));
    
    // Show the selected screen
    const targetScreen = document.getElementById(id);
    if (targetScreen) {
        targetScreen.classList.add("active");
    }
}

// DOM Elements
const playerNameInput = document.getElementById("player-name");
const registerBtn = document.getElementById("register-btn");
const startBtn = document.getElementById("start-btn");
const p1NameSpan = document.getElementById("p1-name");
const p2NameSpan = document.getElementById("p2-name");
const p1Slot = document.getElementById("p1-slot");
const p2Slot = document.getElementById("p2-slot");
const playAgainBtn = document.getElementById("play-again-btn");
const mainMenuBtn = document.getElementById("main-menu-btn");

// Handle "Register & Sign In" button click
registerBtn.addEventListener("click", () => {
    const name = playerNameInput.value.trim();
    
    if (!name) {
        alert("Please enter your name");
        return;
    }
    
    // Store local name
    myName = name;
    
    // Emit register event to server
    socket.emit("register", { name });
});

// Allow pressing Enter in the name input to register
playerNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        registerBtn.click();
    }
});

// Listen for registration errors
socket.on("registerError", (data) => {
    alert(data.message);
    mySlot = null;
    myName = null;
});

// Listen for successful registration
socket.on("registerSuccess", (data) => {
    console.log(`Registered as ${data.slot}: ${data.name}`);
    mySlot = data.slot;
    
    // Disable the registration form after successful registration
    playerNameInput.disabled = true;
    registerBtn.disabled = true;
});

// Listen for lobby updates from server
socket.on("lobbyUpdate", (players) => {
    console.log("Lobby update:", players);
    
    // Reset player name displays
    p1NameSpan.textContent = "[Waiting]";
    p1NameSpan.className = "waiting";
    p2NameSpan.textContent = "[Waiting]";
    p2NameSpan.className = "waiting";
    
    // Reset slot styling
    p1Slot.classList.remove("connected");
    p2Slot.classList.remove("connected");
    
    // Fill in connected players
    players.forEach(player => {
        if (player.slot === "P1") {
            p1NameSpan.textContent = player.name;
            p1NameSpan.className = "player-name";
            p1Slot.classList.add("connected");
            
            // Check if this is me
            if (player.name === myName) {
                mySlot = "P1";
            }
        } else if (player.slot === "P2") {
            p2NameSpan.textContent = player.name;
            p2NameSpan.className = "player-name";
            p2Slot.classList.add("connected");
            
            // Check if this is me
            if (player.name === myName) {
                mySlot = "P2";
            }
        }
    });
    
    // Enable start button only when there are exactly 2 players
    if (players.length === 2) {
        startBtn.disabled = false;
    } else {
        startBtn.disabled = true;
    }
});

// Handle "Start Game" button click
startBtn.addEventListener("click", () => {
    // Only Player 1 can start the game
    if (mySlot !== "P1") {
        alert("Only Player 1 can start the game");
        return;
    }
    
    // Emit hostStartGame event
    socket.emit("hostStartGame");
});

// Listen for game start from server
socket.on("gameStart", (data) => {
    console.log("Game starting:", data);
    
    // Initialize the game (defined in game.js)
    if (typeof initGame === "function") {
        initGame(data, mySlot);
    }
    
    // Switch to game screen
    showScreen("game-page");
});

// Listen for game over
socket.on("gameOver", (summary) => {
    console.log("Game over:", summary);
    
    // Show game over screen (defined in game.js)
    if (typeof showGameOverScreen === "function") {
        showGameOverScreen(summary);
    }
    
    // Switch to game over screen
    showScreen("game-over-page");
});

// Listen for opponent disconnected during game
socket.on("opponentDisconnected", (data) => {
    alert(data.message);
    
    // Reset to front page
    window.location.reload();
});

// Handle "Play Again" button
playAgainBtn.addEventListener("click", () => {
    // Simple implementation: reload the page
    window.location.reload();
});

// Handle "Main Menu" button
mainMenuBtn.addEventListener("click", () => {
    // Return to front page by reloading
    window.location.reload();
});

// Export socket for use in game.js
window.gameSocket = socket;
window.showScreen = showScreen;
