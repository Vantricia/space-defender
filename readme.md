COMP 4021 Group Project

Game : Space Defenders
WONG, Vantricia (20896118)
WIDJAJA, Meidyana Audrey (20916724)


Directory Structure

space-defenders/
│
├── server.js                  ← Node.js + Socket.IO server (backend)
├── users.json                 ← Will be Auto-created: stores accounts & stats
│
├── public/                    ← Everything the browser loads
│   ├── index.html             ← Main page 
│   ├── character.js           ← Character selection + sprite drawing
│   ├── asteroid.js            ← Asteroid factory + movement
│   ├── gem.js                 ← Gem factory + rotation
│   ├── client.js              ← Login, lobby, UI flow, socket logic
│   ├── game.js                ← Game loop, physics, rendering, sync
│   │
│   └── effects/               ← All images
│       ├── asteroids.png      ← 8×8 grid → 64 different asteroids (1024×1024)
│       ├── characters.png     ← 3×2 grid → 6 spaceships
│       ├── bullet.png
│       ├── gem.jpeg
│       └── background.jpg 
│
└── package.json               ← Stores Dependency

How to run : 
npm install
node server.js