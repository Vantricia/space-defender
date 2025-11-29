const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const server = http.createServer(app);
//const io = new Server(server);

const sessionMiddleware = session({
    secret: "space-defender-super-secret-2025",
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 10 * 60 * 1000,  // 10 minutes
        httpOnly: true,
        secure: false,   // change to true when using HTTPS
        sameSite: "lax"
    }
});

app.use(sessionMiddleware);

// Database file path
const DB_FILE = path.join(__dirname, "users.json");

// Load or initialize user database
let userDatabase = { users: [] };

function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, "utf8");
            userDatabase = JSON.parse(data);
            console.log(`[DB] Loaded ${userDatabase.users.length} users from database`);
        } else {
            console.log("[DB] No database file found, creating new one");
            saveDatabase();
        }
    } catch (error) {
        console.error("[DB] Error loading database:", error);
        userDatabase = { users: [] };
    }
}

function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(userDatabase, null, 2), "utf8");
        console.log("[DB] Database saved successfully");
    } catch (error) {
        console.error("[DB] Error saving database:", error);
    }
}

// Initialize database on startup
loadDatabase();

// Serve static files from public directory
app.use(express.static("public"));
app.use(express.json());

// Share session with Socket.IO (THIS IS THE KEY)
const io = new Server(server, {
    cors: {
        origin: "http://localhost:8000",
        credentials: true
    }
});

io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// In-memory lobby state
const lobby = {
    players: [],        // Array of { id, name, slot }
    gameStarted: false
};

// Socket.io connection handling
io.on("connection", (socket) => {
    const session = socket.request.session;
    console.log(`[CONNECT] ${socket.id} | User: ${session.username || 'Guest'}`);

    // AUTO-LOGIN IF SESSION EXISTS
    if (session.username) {
        socket.emit("autoLogin", {
            username: session.username,
            stats: getUserStats(session.username) || { gamesPlayed: 0, wins: 0, totalScore: 0 }
        });
    }

    console.log(`[INFO] New connection: ${socket.id}`);

    // Handle user registration (create new account)
    socket.on("createAccount", (data) => {
        const { username, password } = data;

        // Validate input
        if (!username || username.trim() === "") {
            socket.emit("createAccountError", { message: "Username cannot be empty" });
            return;
        }

        if (!password || password.length < 4) {
            socket.emit("createAccountError", { message: "Password must be at least 4 characters" });
            return;
        }

        // Check if username already exists
        const existingUser = userDatabase.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
        if (existingUser) {
            socket.emit("createAccountError", { message: "Username already taken" });
            return;
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        // Create new user
        const newUser = {
            username: username.trim(),
            password: passwordHash, // In production, use bcrypt to hash passwords
            createdAt: new Date().toISOString(),
            gamesPlayed: 0,
            wins: 0,
            totalScore: 0
        };

        userDatabase.users.push(newUser);
        saveDatabase();

        // Save session after account creation
        session.username = newUser.username;
        session.save((err) => {
            if (err) {
                console.error("[SESSION] Save error:", err);
            }
        });

        console.log(`[DB] New user created: ${newUser.username}`);
        socket.emit("createAccountSuccess", { username: newUser.username });
    });

    // Handle user login
    socket.on("login", (data) => {
        const { username, password } = data;

        // Validate input
        if (!username || !password) {
            socket.emit("loginError", { message: "Username and password required" });
            return;
        }

        // Find user in database
        const user = userDatabase.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
        if (!user) {
            socket.emit("loginError", { message: "User not found" });
            return;
        }

        if (!bcrypt.compareSync(password, user.password)) {
            socket.emit("loginError", { message: "Incorrect password" });
            return;
        }

        // SAVE USERNAME TO SESSION - THIS IS THE KEY PART
        const session = socket.request.session;
        session.username = user.username;
        session.save((err) => {
            if (err) {
                console.error("[SESSION] Save error:", err);
            }
        });

        console.log(`[DB] User logged in: ${user.username}`);
        socket.emit("loginSuccess", { 
            username: user.username,
            stats: {
                gamesPlayed: user.gamesPlayed,
                wins: user.wins,
                totalScore: user.totalScore
            }
        });
    });

    // Handle logout
    socket.on("logout", () => {
        console.log(`[AUTH] User logged out: ${session.username}`);
        session.username = null;
        session.save();
    });

    // Handle player registration (join lobby with character)
    socket.on("register", (data) => {
        const { name, character } = data;

        // Validate name
        if (!name || name.trim() === "") {
            socket.emit("registerError", { message: "Name cannot be empty" });
            return;
        }

        // Validate character
        if (character === undefined || character === null || character < 0 || character > 5) {
            socket.emit("registerError", { message: "Please select a character" });
            return;
        }

        // Check if lobby is full or game already started
        if (lobby.players.length >= 2) {
            socket.emit("registerError", { message: "Lobby is full" });
            return;
        }

        if (lobby.gameStarted) {
            socket.emit("registerError", { message: "Game already in progress" });
            return;
        }

        // Check if character is already taken
        const characterTaken = lobby.players.some(p => p.character === character);
        if (characterTaken) {
            socket.emit("registerError", { message: "Character already taken" });
            return;
        }

        // Assign slot based on current lobby size
        const slot = lobby.players.length === 0 ? "P1" : "P2";

        // Add player to lobby
        const player = {
            id: socket.id,
            name: name.trim(),
            slot: slot,
            character: character
        };
        lobby.players.push(player);

        console.log(`[REGISTER] ${name} joined as ${slot} with character ${character}`);

        // Emit registration success to this socket
        socket.emit("registerSuccess", { slot, name: player.name, character });

        // Broadcast lobby update to all clients
        const lobbyData = lobby.players.map(p => ({ slot: p.slot, name: p.name, character: p.character }));
        io.emit("lobbyUpdate", lobbyData);
    });

    // Handle game start (only host/P1 can start)
    socket.on("hostStartGame", () => {
        // Check if this socket is Player 1
        const player = lobby.players.find(p => p.id === socket.id);
        if (!player || player.slot !== "P1") {
            socket.emit("error", { message: "Only Player 1 can start the game" });
            return;
        }

        // Check if we have exactly 2 players and game hasn't started
        if (lobby.players.length !== 2) {
            socket.emit("error", { message: "Need 2 players to start" });
            return;
        }

        if (lobby.gameStarted) {
            socket.emit("error", { message: "Game already started" });
            return;
        }

        // Mark game as started
        lobby.gameStarted = true;
        console.log("[GAME] Game starting with players:", lobby.players.map(p => p.name).join(", "));

        // Prepare game start data
        const gameData = {
            duration: 180, // 3 minutes in seconds
            players: lobby.players.map(p => ({
                slot: p.slot,
                name: p.name,
                id: p.id,
                character: p.character
            }))
        };

        // Emit game start to all clients
        io.emit("gameStart", gameData);
    });

    // Handle cheat mode toggle
    socket.on("cheatModeToggle", (data) => {
        console.log(`[CHEAT] ${data.slot} cheat mode: ${data.enabled}`);
        socket.broadcast.emit("cheatModeToggle", data);
    });

    // Handle real-time player input synchronization
    socket.on("playerInput", (data) => {
        // Broadcast to all other clients
        socket.broadcast.emit("playerInput", data);
    });

    // Handle real-time shooting
    socket.on("shoot", (data) => {
        // Broadcast to all other clients
        socket.broadcast.emit("shoot", data);
    });

    // Handle game state updates
    socket.on("stateUpdate", (data) => {
        // Broadcast to all other clients
        socket.broadcast.emit("stateUpdate", data);
    });

    // Handle gem collected
    socket.on("gemCollected", (data) => {
        socket.broadcast.emit("gemCollected", data);
    });

    // Handle asteroid crash
    socket.on("asteroidCrash", (data) => {
        socket.broadcast.emit("asteroidCrash", data);
    });

    // Handle play again request
    socket.on("playAgain", () => {
        const session = socket.request.session;
        console.log(`[LOBBY] Play again request from ${session.username || socket.id}`);
        
        // Remove this player from lobby if they're in it
        const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            lobby.players.splice(playerIndex, 1);
        }
        
        // Reset game started flag if no players left
        if (lobby.players.length === 0) {
            lobby.gameStarted = false;
        }
        
        // Send updated lobby state to all clients
        const lobbyData = lobby.players.map(p => ({ slot: p.slot, name: p.name, character: p.character }));
        io.emit("lobbyUpdate", lobbyData);
        
        console.log(`[LOBBY] After playAgain: ${lobby.players.length} players in lobby`);
    });

    // Handle game over
    socket.on("gameOver", (data) => {
        console.log("[GAME] Game over:", data);

        // Update user statistics
        const winnerSlot = data.winner;
        lobby.players.forEach(player => {
            const user = userDatabase.users.find(u => u.username.toLowerCase() === player.name.toLowerCase());
            if (user) {
                user.gamesPlayed = (user.gamesPlayed || 0) + 1;
                
                const playerData = data.players[player.slot];
                if (playerData) {
                    user.totalScore = (user.totalScore || 0) + playerData.score;
                    
                    if (player.slot === winnerSlot) {
                        user.wins = (user.wins || 0) + 1;
                    }
                }
            }
        });
        
        saveDatabase();

        // Broadcast game over to all clients
        io.emit("gameOver", data);

        // Reset lobby state
        lobby.players = [];
        lobby.gameStarted = false;
        console.log("[LOBBY] Lobby reset after game over");
    });

    // Handle player disconnect
    socket.on("disconnect", () => {
        console.log(`[INFO] Disconnect: ${socket.id}`);

        // Find the disconnected player
        const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
        
        if (playerIndex === -1) {
            // Player was not in lobby
            return;
        }

        const disconnectedPlayer = lobby.players[playerIndex];
        console.log(`[DISCONNECT] ${disconnectedPlayer.name} (${disconnectedPlayer.slot}) left`);

        // Remove player from lobby
        lobby.players.splice(playerIndex, 1);

        if (lobby.gameStarted) {
            // Game was in progress - notify remaining player and reset
            socket.broadcast.emit("opponentDisconnected", {
                message: `${disconnectedPlayer.name} disconnected. You win!`
            });

            // Reset lobby
            lobby.players = [];
            lobby.gameStarted = false;
            console.log("[LOBBY] Lobby reset due to disconnect during game");
        } else {
            // Game hasn't started yet - just update lobby
            const lobbyData = lobby.players.map(p => ({ slot: p.slot, name: p.name, character: p.character }));
            io.emit("lobbyUpdate", lobbyData);
            console.log("[LOBBY] Updated after disconnect");
        }
    });
});

// Helper function to get user stats
function getUserStats(username) {
    const user = userDatabase.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        return {
            gamesPlayed: user.gamesPlayed || 0,
            wins: user.wins || 0,
            totalScore: user.totalScore || 0
        };
    }
    return null;
}

// Start server
const PORT = 8000;
server.listen(PORT, () => {
    console.log(`[SERVER] Space Defenders server running at http://localhost:${PORT}`);
});
