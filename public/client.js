// Connect to socket.io server
const socket = io( { withCredentials: true } );

// Track local player info
let mySlot = null;
let myName = null;
let loggedInUsername = null;
let isLoggedIn = false;

// Initialize character selection
if (typeof initCharacterSelection === 'function') {
    initCharacterSelection();
}

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

// Helper function to show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("show");
    }
}

// Helper function to hide modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("show");
    }
}

// DOM Elements - Modals
const loginModal = document.getElementById("login-modal");
const registerModal = document.getElementById("register-modal");
const logoutConfirmModal = document.getElementById("logout-confirm-modal");
const showLoginBtn = document.getElementById("show-login-btn");
const showRegisterBtn = document.getElementById("show-register-btn");
const closeLoginModalBtn = document.getElementById("close-login-modal");
const closeRegisterModalBtn = document.getElementById("close-register-modal");
const logoutBtn = document.getElementById("logout-btn");
const confirmLogoutBtn = document.getElementById("confirm-logout-btn");
const cancelLogoutBtn = document.getElementById("cancel-logout-btn");

// DOM Elements - Auth
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const registerUsername = document.getElementById("register-username");
const registerPassword = document.getElementById("register-password");
const createAccountBtn = document.getElementById("create-account-btn");
const loggedInUsernameSpan = document.getElementById("logged-in-username");
const welcomeMessage = document.getElementById("welcome-message");
const authButtonsSection = document.getElementById("auth-buttons-section");
const lobbyContainer = document.getElementById("lobby-container");

// DOM Elements - Lobby
const playerNameInput = document.getElementById("player-name");
const registerBtn = document.getElementById("register-btn");
const startBtn = document.getElementById("start-btn");
const p1NameSpan = document.getElementById("p1-name");
const p2NameSpan = document.getElementById("p2-name");
const p1Slot = document.getElementById("p1-slot");
const p2Slot = document.getElementById("p2-slot");
const playAgainBtn = document.getElementById("play-again-btn");
const mainMenuBtn = document.getElementById("main-menu-btn");

// Handle auto-login from server session (for page refresh)
socket.on("autoLogin", (data) => {
    console.log("Auto-login:", data.username);
    
    loggedInUsername = data.username;
    myName = data.username;
    isLoggedIn = true;
    
    // Update UI
    loggedInUsernameSpan.textContent = data.username;
    welcomeMessage.style.display = "block";
    logoutBtn.style.display = "inline-block";
    authButtonsSection.style.display = "none";
    lobbyContainer.style.display = "flex";
    
    // Set player name
    playerNameInput.value = data.username;
    
    // Show stats if available
    if (data.stats) {
        console.log("User stats:", data.stats);
    }
});

// Modal button handlers
showLoginBtn.addEventListener('click', () => {
    showModal("login-modal");
});

showRegisterBtn.addEventListener('click', () => {
    showModal("register-modal");
});

closeLoginModalBtn.addEventListener('click', () => {
    hideModal("login-modal");
});

closeRegisterModalBtn.addEventListener('click', () => {
    hideModal("register-modal");
});

logoutBtn.addEventListener('click', () => {
    showModal("logout-confirm-modal");
});

confirmLogoutBtn.addEventListener('click', () => {
    // Tell server to clear session
    socket.emit("logout");

    // Logout logic
    isLoggedIn = false;
    loggedInUsername = null;
    myName = null;
    
    // Update UI
    welcomeMessage.style.display = "none";
    logoutBtn.style.display = "none";
    authButtonsSection.style.display = "flex";
    lobbyContainer.style.display = "none";
    
    // Clear form fields
    loginUsername.value = "";
    loginPassword.value = "";
    registerUsername.value = "";
    registerPassword.value = "";
    
    hideModal("logout-confirm-modal");
    
    // Reset lobby UI if needed
    const characterOptions = document.querySelectorAll('.character-option');
    characterOptions.forEach(option => option.classList.remove('selected'));
});

cancelLogoutBtn.addEventListener('click', () => {
    hideModal("logout-confirm-modal");
});

// Close modals when clicking outside
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        hideModal("login-modal");
        hideModal("register-modal");
        hideModal("logout-confirm-modal");
    }
});

// Handle create account
createAccountBtn.addEventListener('click', () => {
    const username = registerUsername.value.trim();
    const password = registerPassword.value;
    
    if (!username) {
        alert("Please enter a username");
        return;
    }
    
    if (!password || password.length < 4) {
        alert("Password must be at least 4 characters");
        return;
    }
    
    socket.emit("createAccount", { username, password });
});

// Handle login
loginBtn.addEventListener('click', () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    
    if (!username || !password) {
        alert("Please enter username and password");
        return;
    }
    
    socket.emit("login", { username, password });
});

// Allow Enter key for login
loginPassword.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        loginBtn.click();
    }
});

// Allow Enter key for registration
registerPassword.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        createAccountBtn.click();
    }
});

// Listen for create account responses
socket.on("createAccountError", (data) => {
    alert(data.message);
});

socket.on("createAccountSuccess", (data) => {
    alert(`Account created successfully! Welcome, ${data.username}`);
    
    // Auto-login after successful registration
    loggedInUsername = data.username;
    myName = data.username;
    isLoggedIn = true;
    
    // Update UI
    loggedInUsernameSpan.textContent = data.username;
    welcomeMessage.style.display = "block";
    logoutBtn.style.display = "inline-block";
    authButtonsSection.style.display = "none";
    lobbyContainer.style.display = "flex";
    
    // Set player name
    playerNameInput.value = data.username;
    
    // Clear form and hide modal
    registerUsername.value = '';
    registerPassword.value = '';
    hideModal("register-modal");
});

// Listen for login responses
socket.on("loginError", (data) => {
    alert(data.message);
});

socket.on("loginSuccess", (data) => {
    loggedInUsername = data.username;
    myName = data.username;
    isLoggedIn = true;
    
    // Update UI
    loggedInUsernameSpan.textContent = data.username;
    welcomeMessage.style.display = "block";
    logoutBtn.style.display = "inline-block";
    authButtonsSection.style.display = "none";
    lobbyContainer.style.display = "flex";
    
    // Show stats if available
    if (data.stats) {
        console.log("User stats:", data.stats);
    }
    
    // Set player name
    playerNameInput.value = data.username;
    
    // Clear form and hide modal
    loginUsername.value = '';
    loginPassword.value = '';
    hideModal("login-modal");
});

// Handle "Ready" button click (join lobby)
registerBtn.addEventListener('click', () => {
    if (!isLoggedIn) {
        alert("Please login or register first");
        return;
    }
    
    // Username is already set from login
    const name = myName;
    
    if (!name) {
        alert("Please login first");
        return;
    }
    
    const character = getSelectedCharacter();
    if (character === null) {
        alert("Please choose a spaceship");
        return;
    }
    
    // Emit register event to server with character
    socket.emit("register", { name, character });
});

// Listen for registration errors
socket.on("registerError", (data) => {
    alert(data.message);
    mySlot = null;
});

// Listen for successful registration
socket.on("registerSuccess", (data) => {
    console.log(`Registered as ${data.slot}: ${data.name}`);
    mySlot = data.slot;
    
    // Disable the ready button after successful registration
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
    
    // Hide character icons
    document.getElementById("p1-character").style.display = "none";
    document.getElementById("p2-character").style.display = "none";
    
    // Fill in connected players
    players.forEach(player => {
        if (player.slot === "P1") {
            p1NameSpan.textContent = player.name;
            p1NameSpan.className = "player-name";
            p1Slot.classList.add("connected");
            
            // Show character icon
            if (player.character !== undefined && player.character !== null) {
                const canvas = document.getElementById("p1-character");
                const ctx = canvas.getContext("2d");
                canvas.style.display = "inline-block";
                drawCharacterSprite(ctx, player.character, 0, 0, 30);
            }
            
            // Check if this is me
            if (player.name === myName) {
                mySlot = "P1";
            }
        } else if (player.slot === "P2") {
            p2NameSpan.textContent = player.name;
            p2NameSpan.className = "player-name";
            p2Slot.classList.add("connected");
            
            // Show character icon
            if (player.character !== undefined && player.character !== null) {
                const canvas = document.getElementById("p2-character");
                const ctx = canvas.getContext("2d");
                canvas.style.display = "inline-block";
                drawCharacterSprite(ctx, player.character, 0, 0, 30);
            }
            
            // Check if this is me
            if (player.name === myName) {
                mySlot = "P2";
            }
        }
    });
    
    // Update character availability
    if (typeof updateCharacterAvailability === 'function') {
        updateCharacterAvailability(players);
    }
    
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
    
    // Switch to game screen
    showScreen("game-page");
    
    // Show player-specific instructions for 3 seconds
    showGameInstructions(mySlot);
    
    // Initialize the game immediately (but paused)
    if (typeof initGame === "function") {
        initGame(data, mySlot);
    }
    
    // Auto-hide overlay and start game after 3 seconds
    setTimeout(() => {
        const overlay = document.getElementById("game-instructions-overlay");
        if (overlay) {
            overlay.classList.remove("show");
        }
        
        // Start the game countdown and spawning
        if (window.gameState) {
            window.gameState.running = true;
        }
    }, 3000);
});

// Show game instructions overlay with player-specific controls
function showGameInstructions(slot) {
    const overlay = document.getElementById("game-instructions-overlay");
    const roleText = document.getElementById("player-role-text");
    const moveKeys = document.getElementById("move-keys");
    const shootKey = document.getElementById("shoot-key");
    
    // Set player role
    roleText.textContent = slot === "P1" ? "PLAYER 1" : "PLAYER 2";
    roleText.style.color = slot === "P1" ? "#00ff88" : "#ff00ff";
    
    // Set controls based on player
    if (slot === "P1") {
        moveKeys.innerHTML = `
            <span class="key-display">W</span>
            <span class="key-display">A</span>
            <span class="key-display">S</span>
            <span class="key-display">D</span>
        `;
        shootKey.innerHTML = `<span class="key-display">SPACE</span>`;
    } else {
        moveKeys.innerHTML = `
            <span class="key-display">↑</span>
            <span class="key-display">←</span>
            <span class="key-display">↓</span>
            <span class="key-display">→</span>
        `;
        shootKey.innerHTML = `<span class="key-display">ENTER</span>`;
    }
    
    // Show overlay
    overlay.classList.add("show");
}

// Listen for game over
socket.on("gameOver", (summary) => {
    console.log("Game over:", summary);

    // Stop background music (in case it's still playing)
    if (typeof stopBackgroundMusic === 'function') {
        stopBackgroundMusic();
    }
    
    // Show game over screen (defined in game.js)
    if (typeof showGameOverScreen === "function") {
        showGameOverScreen(summary);
    }
    
    // Switch to game over screen
    showScreen("game-over-page");
});

// Listen for opponent disconnected during game
socket.on("opponentDisconnected", (data) => {
    if (typeof stopBackgroundMusic === 'function') {
        stopBackgroundMusic();
    }

    alert(data.message);
    
    // Reset to front page
    window.location.reload();
});

// Handle "Play Again" button
playAgainBtn.addEventListener("click", () => {
    // Re-enable the Ready button for next game
    registerBtn.disabled = false;
    mySlot = null;
    
    // Return to lobby
    showScreen("front-page");
    
    // Re-show auth buttons if logged out
    if (!isLoggedIn) {
        welcomeMessage.style.display = "none";
        logoutBtn.style.display = "none";
        authButtonsSection.style.display = "flex";
        lobbyContainer.style.display = "none";
    }
});

// Handle "Main Menu" button
mainMenuBtn.addEventListener("click", () => {
    // Return to auth screen
    loggedInUsername = null;
    myName = null;
    mySlot = null;
    isLoggedIn = false;
    
    // Update UI
    welcomeMessage.style.display = "none";
    logoutBtn.style.display = "none";
    authButtonsSection.style.display = "flex";
    lobbyContainer.style.display = "none";
    showScreen("front-page");
    
    // Clear forms
    loginUsername.value = '';
    loginPassword.value = '';
    registerUsername.value = '';
    registerPassword.value = '';
});

// Export socket for use in game.js
window.gameSocket = socket;
window.showScreen = showScreen;
