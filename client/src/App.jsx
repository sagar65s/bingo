import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "./services/api";
import { createSocket } from "./socket/socket";
import { BOARD_SIZE, REQUIRED_LINES, makeDemoBoard } from "./utils/game";

const demoFeatures = ["Real-time multiplayer", "Private rooms", "2–7 players", "Responsive boards", "Server-authoritative rules"];

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const submit = async e => {
    e.preventDefault(); setError("");
    try {
      const data = await api(mode === "login" ? "/auth/login" : "/uth/register", { method: "POST", body: JSON.stringify(form) });
      localStorage.setItem("bingo_token", data.token); onLogin(data.user);
    } catch (err) { setError(err.message) }
  };
  return <div className="auth-page">
    <div className="auth-card">
      <div className="brand-small"><span>B</span><b>BINGO</b></div>
      <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
      <p className="muted">Play real-time multiplayer Bingo with friends.</p>
      <form onSubmit={submit}>
        {mode === "register" && <input placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />}
        <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        <div className="password-wrap"><input type={form.showPassword ? "text" : "password"} placeholder="Password (6+ characters)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength="6" required /><button type="button" className="show-pass" onClick={() => setForm({ ...form, showPassword: !form.showPassword })}>{form.showPassword ? "Hide" : "Show"}</button></div>
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit">{mode === "login" ? "Login" : "Register"}</button>
      </form>
      <button className="link-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}>
        {mode === "login" ? "Create an account" : "Already have an account? Login"}
      </button>
    </div>
  </div>
}

function Dashboard({ user, onLogout }) {
  const [socket, setSocket] = useState(null), [room, setRoom] = useState(null), [game, setGame] = useState(null);
  const [roomName, setRoomName] = useState("Friends Room"), [password, setPassword] = useState("123456"), [maxPlayers, setMaxPlayers] = useState(4);
  const [joinId, setJoinId] = useState(""), [joinPassword, setJoinPassword] = useState(""), [message, setMessage] = useState("");
  const [board, setBoard] = useState(null), [call, setCall] = useState("");

  useEffect(() => {
    const s = createSocket();
    setSocket(s); window.__bingoSocket = s;
    s.on("error:message", e => setMessage(e.message));
    s.on("room:update", e => setRoom(e.room));
    s.on("room:started", e => { setRoom(e.room); setGame(e.game); s.emit("game:join", { gameId: e.game.gameId }) });
    s.on("game:state", e => { setGame(e.game); if (e.game.status === "PLAYING" || e.game.status === "BOARD_SETUP") setBoard(e.game.players.find(p => p.userId === user._id)?.board || null) });
    s.on("game:move", e => setGame(e.game));
    return () => s.disconnect();
  }, [user._id]);

  const create = async () => {
    try { const d = await api("/rooms", { method: "POST", body: JSON.stringify({ roomName, password, maxPlayers: Number(maxPlayers) }) }); setRoom(d.room); socket?.emit("room:join", { roomId: d.room.roomId }); setMessage("Room created. Share the room ID with friends."); }
    catch (e) { setMessage(e.message) }
  };
  const join = async () => {
    try { const d = await api("/rooms/join", { method: "POST", body: JSON.stringify({ roomId: joinId, password: joinPassword }) }); setRoom(d.room); socket?.emit("room:join", { roomId: d.room.roomId }); setMessage("Joined room."); }
    catch (e) { setMessage(e.message) }
  };
  const toggleReady = () => socket?.emit("room:ready", { roomId: room.roomId, ready: !room.players.find(p => p.userId === user._id)?.ready });
  const start = () => socket?.emit("room:start", { roomId: room.roomId });
  const submitBoard = () => {
    if (!game || !board) return;
    socket.emit("game:boardSubmit", { gameId: game.gameId, board });
  };
  const callNumber = () => { if (call) socket.emit("game:numberCall", { gameId: game.gameId, number: Number(call) }); setCall("") };

  if (room && game) return <Game user={user} room={room} game={game} board={board} setBoard={setBoard} submitBoard={submitBoard} call={call} setCall={setCall} callNumber={callNumber} onLogout={onLogout} />;
  if (room) return <Lobby user={user} room={room} toggleReady={toggleReady} start={start} onLogout={onLogout} message={message} />;

  return <div className="dashboard">
    <header className="topbar"><div className="brand"><span>B</span><strong>BINGO</strong></div><div className="user-chip">{user.username}<small>{user.uid}</small><button onClick={onLogout}>Logout</button></div></header>
    <main className="dash-content">
      <motion.section className="welcome" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div><p className="eyebrow">MULTIPLAYER DASHBOARD</p><h1>Ready to play, {user.username}?</h1><p className="muted">Create a private room or join a friend's room.</p></div>
        <div className="stats"><div><b>2–7</b><span>Players</span></div><div><b>5×5–10×10</b><span>Boards</span></div></div>
      </motion.section>
      {message && <div className="notice">{message}</div>}
      <section className="dashboard-grid">
        <div className="panel">
          <h3>Create a room</h3><p className="muted">Choose the maximum player count. The board size is decided automatically when the game starts.</p>
          <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Room name" />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Room password" type="password" />
          <select value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)}>{[2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n} players — {BOARD_SIZE[n]}×{BOARD_SIZE[n]}</option>)}</select>
          <button className="primary" onClick={create}>Create private room</button>
        </div>
        <div className="panel">
          <h3>Join a room</h3><p className="muted">Enter the room ID and password shared by the host.</p>
          <input value={joinId} onChange={e => setJoinId(e.target.value.toUpperCase())} placeholder="Room ID" />
          <input value={joinPassword} onChange={e => setJoinPassword(e.target.value)} placeholder="Password" type="password" />
          <button className="secondary" onClick={join}>Join room</button>
        </div>
      </section>
      <section className="feature-strip">{demoFeatures.map(x => <div key={x}><i /> {x}</div>)}</section>
    </main>
  </div>
}

function Lobby({ user, room, toggleReady, start, onLogout, message }) {
  const me = room.players.find(p => p.userId === user._id);
  return <div className="dashboard">
    <header className="topbar"><div className="brand"><span>B</span><strong>BINGO</strong></div><button className="ghost" onClick={onLogout}>Logout</button></header>
    <main className="lobby">
      <div className="room-head"><div><p className="eyebrow">PRIVATE ROOM</p><h1>{room.roomName}</h1><div className="room-id">ROOM <b>{room.roomId}</b></div></div><div className="room-rule"><b>{room.players.length}/{room.maxPlayers}</b><span>Players</span></div></div>
      {message && <div className="notice">{message}</div>}
      <div className="player-grid">{room.players.map((p, i) => <motion.div className={`player-card ${p.ready ? "ready" : ""}`} key={p.userId} layout><div className="avatar">{p.username.slice(0, 1).toUpperCase()}</div><div><b>{p.username}</b><small>{p.userId === room.hostId ? "HOST" : "PLAYER"}</small></div><span className="ready-pill">{p.ready ? "READY" : "WAITING"}</span></motion.div>)}</div>
      <div className="lobby-actions"><button className={me?.ready ? "secondary" : "primary"} onClick={toggleReady}>{me?.ready ? "Not ready" : "I'm ready"}</button>{room.hostId === user._id && <button className="primary" disabled={room.players.length < 2 || !room.players.every(p => p.ready)} onClick={start}>Start game</button>}</div>
      <p className="muted center">All players must be ready before the host can start.</p>
    </main>
  </div>
}

function Game({ user, room, game, board, setBoard, submitBoard, onLogout }) {
  const size = game.boardSize;
  const my = game.players.find(p => p.userId === user._id);
  const isSetup = game.status === "BOARD_SETUP";
  const isMyTurn = game.currentTurn === user._id;
  const localBoard = useMemo(() => board?.length === size ? board : Array.from({ length: size }, () => Array(size).fill("")), [board, size]);
  const [activeCell, setActiveCell] = useState(0);
  const changeCell = (r, c, val) => { if (!isSetup) return; const clean = String(val).replace(/\D/g, "").slice(0, 5); const next = localBoard.map(row => [...row]); next[r][c] = clean; setBoard(next); if (clean && activeCell < size * size - 1) { const n = activeCell + 1; setActiveCell(n); requestAnimationFrame(() => document.querySelector(`[data-cell="${n}"]`)?.focus()) } };
  const onKey = (e, index) => { let n = null; if (["Enter", "ArrowRight", "ArrowDown"].includes(e.key)) n = Math.min(size * size - 1, index + 1); else if (["ArrowLeft", "ArrowUp"].includes(e.key)) n = Math.max(0, index - 1); else if (e.key === "Backspace" && !localBoard[Math.floor(index / size)][index % size]) n = Math.max(0, index - 1); if (n !== null) { e.preventDefault(); setActiveCell(n); document.querySelector(`[data-cell="${n}"]`)?.focus() } };
  const call = (n) => { if (isMyTurn && game.status === "PLAYING") window.__bingoSocket?.emit("game:numberCall", { gameId: game.gameId, number: n }) };
  return <div className="game-page"><header className="topbar"><div className="brand"><span>B</span><strong>BINGO</strong></div><div className={`turn ${isMyTurn && !isSetup ? "my" : ""}`}>{isSetup ? "ENTER YOUR BOARD" : isMyTurn ? "YOUR TURN" : "WAITING FOR CALL"}</div><button className="ghost" onClick={onLogout}>Logout</button></header><main className="game-layout"><section className="board-panel"><div className="game-title"><div><p className="eyebrow">{room.roomId} · {game.playerCount} PLAYERS</p><h2>{game.status === "FINISHED" ? "GAME OVER" : `BINGO ${size}×${size}`}</h2></div><div className="progress"><b>{my?.completedLines || 0}/{game.requiredLines}</b><span>LINES</span></div></div><p className="muted">{isSetup ? "Enter your own numbers. Enter/arrow moves to the next box. Other players cannot see your board until the match begins." : "Click a number to call it. The called number is immediately visible to everyone and marks that number on every opponent board."}</p><div className={`bingo-board ${isSetup ? "editing" : ""}`} style={{ "--size": size }}>{localBoard.map((row, r) => row.map((value, c) => { const idx = r * size + c; const marked = my?.board?.[r]?.[c]?.marked; return <input key={idx} data-cell={idx} className={marked ? "marked" : ""} value={value ?? ""} onFocus={() => setActiveCell(idx)} onKeyDown={e => onKey(e, idx)} onChange={e => changeCell(r, c, e.target.value)} disabled={!isSetup} aria-label={`row ${r + 1} column ${c + 1}`} />; }))}</div>{isSetup ? <button className="primary wide" onClick={submitBoard}>✓ READY — SUBMIT MY BOARD</button> : game.status === "PLAYING" && isMyTurn ? <div className="number-picker"><div className="picker-title"><b>CALL A NUMBER</b><span>Click once to call</span></div><div className="number-grid">{Array.from({ length: size * size }, (_, i) => i + 1).map(n => <button key={n} disabled={game.calledNumbers.includes(n)} className={game.calledNumbers.includes(n) ? "called-number" : ""} onClick={() => call(n)}>{n}</button>)}</div></div> : null}</section><aside className="side-panel"><h3>Players</h3>{game.players.map(p => <div className={`game-player ${p.userId === game.currentTurn ? "active" : ""}`} key={p.userId}><div className="avatar small">{p.username.slice(0, 1).toUpperCase()}</div><div className="gp-name"><b>{p.username}{p.userId === user._id ? " (You)" : ""}</b><span>{p.status}</span></div><div className="gp-score">{p.completedLines}<small>lines</small></div></div>)}<div className="called"><h3>Called numbers</h3><div className="called-list">{game.calledNumbers.length ? game.calledNumbers.map(n => <span key={n}>{n}</span>) : <small className="muted">No numbers called yet.</small>}</div></div>{game.status === "FINISHED" && <div className="result-card"><h3>Final result</h3>{[...game.players].sort((a, b) => (a.rank || 99) - (b.rank || 99)).map(p => <div className="result-row" key={p.userId}><span>{p.rank ? `#${p.rank}` : p.status}</span><b>{p.username}</b><strong>{p.points} pts</strong></div>)}</div>}</aside></main></div>
}

export default function App() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (localStorage.getItem("bingo_token")) api("/auth/me").then(d => setUser(d.user)).catch(() => localStorage.removeItem("bingo_token"));
  }, []);
  const logout = () => { localStorage.removeItem("bingo_token"); setUser(null) };
  return user ? <Dashboard user={user} onLogout={logout} /> : <Auth onLogin={setUser} />;
}
