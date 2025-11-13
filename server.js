const express = require("express");
const http = require("http");
const session = require("express-session");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Session middleware
app.use(session({
    secret: "space-defenders-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Serve static files from public directory
app.use(express.static("public"));

// In-memory lobby state
const lobby = {
    players: [],        // Array of { id, name, slot }
    gameStarted: false
};

// Socket.io connection handling
io.on("connection", (socket) => {
    console.log(`[INFO] New connection: ${socket.id}`);

    // Handle player registration
    socket.on("register", (data) => {
        const { name } = data;

        // Validate name
        if (!name || name.trim() === "") {
            socket.emit("registerError", { message: "Name cannot be empty" });
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

        // Assign slot based on current lobby size
        const slot = lobby.players.length === 0 ? "P1" : "P2";

        // Add player to lobby
        const player = {
            id: socket.id,
            name: name.trim(),
            slot: slot
        };
        lobby.players.push(player);

        console.log(`[REGISTER] ${name} joined as ${slot}`);

        // Emit registration success to this socket
        socket.emit("registerSuccess", { slot, name: player.name });

        // Broadcast lobby update to all clients
        const lobbyData = lobby.players.map(p => ({ slot: p.slot, name: p.name }));
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
                id: p.id
            }))
        };

        // Emit game start to all clients
        io.emit("gameStart", gameData);
    });

    // Handle real-time player input synchronization
    socket.on("playerInput", (data) => {
        // Broadcast to all other clients
        socket.broadcast.emit("playerInput", data);
    });

    // Handle game state updates
    socket.on("stateUpdate", (data) => {
        // Broadcast to all other clients
        socket.broadcast.emit("stateUpdate", data);
    });

    // Handle game over
    socket.on("gameOver", (data) => {
        console.log("[GAME] Game over:", data);

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
            const lobbyData = lobby.players.map(p => ({ slot: p.slot, name: p.name }));
            io.emit("lobbyUpdate", lobbyData);
            console.log("[LOBBY] Updated after disconnect");
        }
    });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] Space Defenders server running at http://localhost:${PORT}`);
});
