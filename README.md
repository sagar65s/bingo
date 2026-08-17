# BINGO Multiplayer — Final Project

A real-time 2–7 player multiplayer BINGO application built with React, Vite, Node.js, Express, Socket.IO and MongoDB/Mongoose.

## Final game rules

| Players | Board | Required lines |
|---:|---:|---:|
| 2 | 5×5 | 5 |
| 3 | 6×6 | 6 |
| 4 | 7×7 | 7 |
| 5 | 8×8 | 8 |
| 6 | 9×9 | 9 |
| 7 | 10×10 | 10 |

- A player calls a number on their turn.
- The server applies that number to opponent boards.
- Horizontal, vertical and diagonal lines count.
- The server is authoritative for turns, boards, marks, lines, ranks, scores, draw and OUT.
- Simultaneous winning states caused by the same authoritative move are a DRAW and receive 0 points.
- The last remaining player is OUT and receives 0 points.
- Game state is synchronized with Socket.IO.
- MongoDB is used when MONGODB_URI is available. The server can boot without MongoDB for local UI/socket development.

## Requirements

- Node.js 20+
- npm 10+
- MongoDB local or MongoDB Atlas for persistence

## Setup

1. Copy `.env.example` to `server/.env`.
2. Change `JWT_SECRET`.
3. Set `MONGODB_URI` if using MongoDB.
4. Install:

```bash
npm install
```

5. Start both apps:

```bash
npm run dev
```

Client: http://localhost:5173  
Server: http://localhost:5000

## Production build

```bash
npm run build
npm start
```

## Important

The game is designed around server-authoritative rules. Do not move winner/ranking/scoring logic into the browser.
