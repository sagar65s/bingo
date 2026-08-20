# BINGO — Final Repaired Multiplayer Project

Production-style real-time 2–7 player BINGO built with React + Vite, Node.js + Express, Socket.IO, JWT/bcrypt and MongoDB/Mongoose.

## What is fixed in this final build

- Login works with previously registered MongoDB accounts after server restart.
- Register no longer sends a UUID into MongoDB's ObjectId `_id` field.
- Room IDs are exactly 6 numeric digits.
- Direct room creation and password-protected joining are synchronized with Socket.IO.
- Ready state is server-authoritative and immediately broadcast to every room member.
- A match starts automatically once every player in a 2–7 player room is ready.
- Board submission is server-validated.
- 5×5 uses numbers 1–25; 6×6 uses 1–36; ...; 10×10 uses 1–100.
- Duplicate numbers are rejected by the server and shown red immediately in the UI.
- Enter and Arrow Left/Right/Up/Down navigate the board without automatic focus movement while typing.
- Submitted board stays visible and becomes locked while waiting for the other player.
- Number calls happen by clicking the number on the main board.
- A valid called number is marked green on the caller and every opponent according to the current requested gameplay behaviour.
- Winner, DRAW and LOSS result screens include animated scoreboard, REMATCH and EXIT.
- Rematch waits for every current player before starting a fresh board setup.
- Back/Exit is available from lobby and game screens.
- Online players are refreshed automatically every 30 seconds and also synchronized by Socket.IO presence events.
- Room invites are targeted to one selected online user only.
- Invite recipient gets Accept/Reject; Accept joins the room, Reject notifies the inviter.
- Invite expiry is 2 minutes and room/full/game-state checks are server-side.
- Password fields have compact Show/Hide controls.
- Original animated animal-square design is preserved without invalid CSS `calc()` modulo syntax.
- Opponent board numbers are not sent to the browser during board setup.

## Final rules

| Players | Board | Required lines |
|---:|---:|---:|
| 2 | 5×5 | 5 |
| 3 | 6×6 | 6 |
| 4 | 7×7 | 7 |
| 5 | 8×8 | 8 |
| 6 | 9×9 | 9 |
| 7 | 10×10 | 10 |

Horizontal, vertical and diagonal lines count. The server remains authoritative for validation, turns, marking, lines, ranking, draw and OUT state.

## Requirements

- Node.js 20+
- npm 10+
- MongoDB Atlas or local MongoDB for persistent accounts

## Local setup

### 1. Install

From the project root:

```bash
npm install
```

### 2. Server environment

Copy:

```text
server/.env.example -> server/.env
```

Set:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=replace_with_a_long_random_secret
```

### 3. Client environment (optional)

Copy:

```text
client/.env.example -> client/.env
```

Defaults already point to localhost. For deployment, set the public API and Socket.IO URLs.

### 4. Run

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:5000/api/health
```

## Test multiplayer correctly

Use **different accounts** in different browser/device sessions. Do not use the same account in three devices when testing the online-player list.

Recommended test:

1. Device A: Account A → create room.
2. Device B: Account B → login.
3. Device A: invite Account B.
4. Device B: Accept.
5. Both devices should show the same room.
6. Both click Ready.
7. Match starts automatically.
8. Both enter unique valid board numbers.
9. Both click READY — SUBMIT MY BOARD.
10. After both submit, gameplay begins.
11. Current player clicks a number directly on the main board.
12. The called number appears marked in real time.
13. Complete the required lines to test WIN/DRAW/LOSS.
14. Test REMATCH and EXIT.

## Production build

```bash
npm run build
npm start
```

For a split deployment, deploy the Vite client as a static site and the Node server as a web service. Set `VITE_API_URL`, `VITE_SOCKET_URL`, `CLIENT_URL`, `MONGODB_URI` and `JWT_SECRET` to the public deployment values.

## Important architecture note

Accounts are persistent in MongoDB when `MONGODB_URI` is configured. Active rooms, Socket.IO presence, invitations and live games are intentionally held in server memory for fast real-time gameplay. A server restart therefore ends active rooms/games; users/accounts remain in MongoDB.
