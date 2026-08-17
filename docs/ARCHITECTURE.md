# Architecture

Client:
- React + Vite
- Framer Motion
- Socket.IO client
- Responsive CSS

Server:
- Express REST API
- Socket.IO real-time layer
- Mongoose persistence
- In-memory fallback for local development

Authority:
- Server validates boards.
- Server validates turns.
- Server applies called numbers to opponent boards.
- Server detects lines.
- Server determines ranking/draw/OUT.
- Client only renders state and submits intent.

Core flow:
Authentication -> Room -> Lobby -> Board Setup -> Gameplay -> Result -> History.
