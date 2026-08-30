import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './services/api'; import { createSocket } from './socket/socket'; import './board-v8.css';
const sizes = { 2: 5, 3: 6, 4: 7, 5: 8 };
function Pass({ value, setValue, show, setShow, placeholder = 'Password' }) { return <div className="password-field"><input type={show ? 'text' : 'password'} value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} /><button type="button" className="eye" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div> }
function Auth({ onLogin }) { const [login, setLogin] = useState(true), [username, setUsername] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [show, setShow] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false); const submit = async e => { e.preventDefault(); setBusy(true); setError(''); try { const d = await api(login ? '/auth/login' : '/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }); localStorage.setItem('bingo_token', d.token); onLogin(d.user) } catch (x) { setError(x.message) } finally { setBusy(false) } }; return <div className="auth-page"><div className="aurora a1" /><div className="aurora a2" /><motion.form className="auth-card" onSubmit={submit} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
<div className="logo">
  <img
    src="/bingo-logo.png"
    alt="BINGO"
    className="bingo-logo"
  />
</div>
<span className="pill">REAL-TIME MULTIPLAYER</span><h1>{login ? 'Welcome back' : 'Create account'}</h1><p>Play smooth multiplayer Bingo with your friends.</p>{!login && <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required />}<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required /><Pass value={password} setValue={setPassword} show={show} setShow={setShow} placeholder="Password (6+ characters)" /><AnimatePresence>{error && <motion.div className="error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>{error}</motion.div>}</AnimatePresence><button className="primary wide" disabled={busy}>{busy ? 'Please wait...' : login ? 'Login' : 'Register'}</button><button type="button" className="text-btn" onClick={() => { setLogin(!login); setError('') }}>{login ? 'New here? Create account' : 'Already have an account? Login'}</button></motion.form></div> }
function App() { const [user, setUser] = useState(null), [loading, setLoading] = useState(true); useEffect(() => { const t = localStorage.getItem('bingo_token'); if (!t) { setLoading(false); return } api('/auth/me').then(d => setUser(d.user)).catch(() => localStorage.removeItem('bingo_token')).finally(() => setLoading(false)) }, []); if (loading) return <div className="loading">Loading BINGO...</div>; return user ? <GameApp user={user} logout={() => { localStorage.removeItem('bingo_token'); setUser(null) }} /> : <Auth onLogin={setUser} /> }
function GameApp({ user, logout }) {
  const sock = useRef(), activeRoomId = useRef(null), [room, setRoom] = useState(null), [game, setGame] = useState(null), [online, setOnline] = useState([]), [invites, setInvites] = useState([]), [sent, setSent] = useState({}), [board, setBoard] = useState(null), [notice, setNotice] = useState(''), [leader, setLeader] = useState([]); const [msgRoom, setMsgRoom] = useState('Friends Room'), [pw, setPw] = useState(''), [showPw, setShowPw] = useState(false), [players, setPlayers] = useState(2), [joinId, setJoinId] = useState(''), [joinPw, setJoinPw] = useState(''), [showJoin, setShowJoin] = useState(false);
  const refresh = () => { api('/players/online').then(d => setOnline(d.players || [])).catch(() => { }); api('/players/leaderboard').then(d => setLeader(d.players || [])).catch(() => { }); setSent(v => Object.fromEntries(Object.entries(v).filter(([, until]) => until > Date.now()))) };
  useEffect(() => {
    const s = createSocket(); sock.current = s; window.__bingoSocket = s; const sync = e => setOnline(e.players || []); s.on('presence:list', sync); s.on('presence:update', sync); s.on('error:message', e => setNotice(e.message)); s.on('room:update', e => {
      const incoming = String(e?.room?.roomId || '');
      if (!incoming) return;
      // A socket is allowed to render only its explicitly active room.
      // Never let a late update from a previously left room overwrite it.
      if (!activeRoomId.current || incoming !== String(activeRoomId.current)) return;
      setRoom(e.room);
    }); s.on('room:joined', e => {
      activeRoomId.current = String(e.room.roomId);
      setRoom(e.room); setGame(null); setBoard(null); setInvites(v => v.filter(x => x.inviteId !== e.inviteId)); setNotice('Joined room successfully')
    }); s.on('room:invite', i => setInvites(v => v.some(x => x.inviteId === i.inviteId) ? v : [i, ...v])); s.on('room:invite:response', e => { setNotice(e.message); if (e.targetUserId) setSent(v => { const n = { ...v }; delete n[String(e.targetUserId)]; return n }) }); s.on('room:started', e => {
      if (activeRoomId.current && String(e.room.roomId) !== String(activeRoomId.current)) return;
      activeRoomId.current = String(e.room.roomId);
      setRoom(e.room); setGame(e.game); setBoard(null); s.emit('game:join', { gameId: e.game.gameId })
    }); const gs = e => { setGame(e.game); const me = e.game.players.find(p => String(p.userId) === String(user._id)); if (me?.board?.length) setBoard(me.board.map(r => r.map(c => String(c?.value ?? '')))); if (e.game.status === 'FINISHED') refresh() }; s.on('game:state', gs); s.on('game:move', gs); refresh(); const t = setInterval(refresh, 30000); return () => { clearInterval(t); activeRoomId.current = null; s.disconnect(); if (window.__bingoSocket === s) delete window.__bingoSocket }
  }, [user._id]);
  const enterSocket = r => {
    const roomId = String(r.roomId);
    // Lock the client to this room before any socket broadcast can arrive.
    activeRoomId.current = roomId;
    sock.current.emit('room:join', { roomId }, ack => {
      if (!ack?.ok) {
        if (activeRoomId.current === roomId) { activeRoomId.current = null; setRoom(null) }
        setNotice(ack?.message || 'Unable to connect to room');
        return;
      }
      // Use the server acknowledgement as the single authoritative initial state.
      activeRoomId.current = String(ack.room.roomId);
      setRoom(ack.room);
    });
  };
  const leaveCurrentSocketRoom = () => {
    const old = activeRoomId.current;
    if (old) sock.current?.emit('room:leave', { roomId: old });
    activeRoomId.current = null;
  };
  const create = async () => {
    try {
      // A new room must never inherit the previous room's socket state.
      leaveCurrentSocketRoom();
      setRoom(null); setGame(null); setBoard(null);
      const d = await api('/rooms', { method: 'POST', body: JSON.stringify({ roomName: msgRoom, password: pw, maxPlayers: Number(players) }) });
      activeRoomId.current = String(d.room.roomId);
      enterSocket(d.room);
      setNotice(`Room created. ID: ${d.room.roomId}`);
    } catch (e) { setNotice(e.message) }
  };
  const join = async () => {
    if (!/^\d{6}$/.test(joinId)) return setNotice('Enter exactly 6 numbers for Room ID');
    try {
      leaveCurrentSocketRoom();
      setRoom(null); setGame(null); setBoard(null);
      const d = await api('/rooms/join', { method: 'POST', body: JSON.stringify({ roomId: joinId, password: joinPw }) });
      activeRoomId.current = String(d.room.roomId);
      enterSocket(d.room);
      setNotice('Joined room successfully');
    } catch (e) { setNotice(e.message) }
  };
  const ready = () => { const me = room.players.find(p => String(p.userId) === String(user._id)); sock.current.emit('room:ready', { roomId: room.roomId, ready: !me?.ready }) };
  const invite = id => { const target = String(id); if (sent[target] > Date.now()) return; sock.current.emit('room:invite', { roomId: room.roomId, targetUserId: id }); setSent(v => ({ ...v, [target]: Date.now() + 30000 })); setNotice('Invite sent. You can invite this player again after 30 seconds.') };
  const respond = (i, yes) => { sock.current.emit(yes ? 'room:invite:accept' : 'room:invite:reject', { inviteId: i.inviteId }); setInvites(v => v.filter(x => x.inviteId !== i.inviteId)) };
  const leave = () => {
    const current = activeRoomId.current || room?.roomId;
    if (current) sock.current?.emit('room:leave', { roomId: current });
    activeRoomId.current = null;
    setRoom(null); setGame(null); setBoard(null); setSent({});
  };
  const rematch = () => { if (!game) return; sock.current.emit('room:rematch', { roomId: game.roomId }) };
  const submit = () => { if (!board) return; const n = game.boardSize, max = n * n, vals = board.flat().map(Number); if (vals.length !== max || vals.some(v => !Number.isInteger(v) || v < 1 || v > max)) return setNotice(`Use every number from 1 to ${max}`); if (new Set(vals).size !== vals.length) return setNotice('Duplicate numbers are not allowed'); sock.current.emit('game:boardSubmit', { gameId: game.gameId, board: board.map(r => r.map(Number)) }); setNotice('Board submitted. Waiting for other players...') };
  if (game) return <Play user={user} game={game} room={room} board={board} setBoard={setBoard} submit={submit} leave={leave} rematch={rematch} notice={notice} />;
  if (room) return <Lobby room={room} user={user} online={online} sent={sent} invite={invite} ready={ready} start={() => sock.current.emit('room:start', { roomId: room.roomId })} leave={leave} notice={notice} invites={invites} respond={respond} />;
  return <main className="app-shell"><Header user={user} logout={logout} /><section className="hero"><div><span className="pill">LIVE • SMOOTH • MULTIPLAYER</span><h1>Play Bingo.<br /><em>Together.</em></h1><p>Create a private room, invite friends and compete in real time.</p></div><div className="hero-orbit"><b>2–5</b><small>PLAYERS</small><span>TOP 10</span></div></section>{notice && <div className="notice">{notice}</div>}<section className="home-grid"><div className="stack"><div className="panel create"><h2>Create a room</h2><input value={msgRoom} onChange={e => setMsgRoom(e.target.value)} placeholder="Room name" /><Pass value={pw} setValue={setPw} show={showPw} setShow={setShowPw} placeholder="Room password" /><select value={players} onChange={e => setPlayers(e.target.value)}>{[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} players — {sizes[n]}×{sizes[n]} board</option>)}</select><button className="primary wide" onClick={create}>Create private room</button></div><div className="panel join"><h2>Join a room</h2><input value={joinId} onChange={e => setJoinId(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit Room ID" maxLength="6" /><Pass value={joinPw} setValue={setJoinPw} show={showJoin} setShow={setShowJoin} placeholder="Room password" /><button className="secondary wide" onClick={join}>Join room</button></div></div><Leaderboard data={leader} /></section><section className="panel online-panel"><div className="section-title"><div><span className="dot" /> ONLINE PLAYERS</div><small>Invite availability refreshes every 30 seconds</small></div>{online.length ? <div className="people">{online.map(p => <div className="person" key={p.userId}><div className="avatar">{p.username?.[0]?.toUpperCase()}</div><div><b>{p.username}</b><small>{p.uid}</small></div><span className="invite-state">Create or join a room to invite</span></div>)}</div> : <div className="empty">No other players online right now.</div>}</section><InviteModal invites={invites} respond={respond} /></main>
}
function Header({ user, logout }) { return <header className="top">
<div className="logo">
  <img
    src="/bingo-logo.png"
    alt="BINGO"
    className="bingo-logo"
  />
</div>
<div className="user"><span>{user.username?.[0]?.toUpperCase()}</span><b>{user.username}</b><button onClick={logout}>Logout</button></div></header> }
function Leaderboard({ data }) { return <aside className="panel leaderboard"><div className="section-title"><b>🏆 TOP 10</b><small>WEEKLY SCOREBOARD • RESETS MONDAY</small></div>{data.length ? data.map((p, i) => <div className="rank" key={p.uid || p.username}><strong>#{i + 1}</strong><span>{p.username}</span><b>{p.weeklyScore || 0}</b></div>) : <div className="empty">Play matches to appear here.</div>}</aside> }
function Lobby({ room, user, online, sent, invite, ready, start, leave, notice, invites, respond }) { const me = room.players.find(p => String(p.userId) === String(user._id)), all = room.players.length >= 2 && room.players.every(p => p.ready), host = String(room.hostId) === String(user._id), available = online.filter(p => !room.players.some(x => String(x.userId) === String(p.userId))); const cooldown = id => Math.max(0, Math.ceil(((sent[String(id)] || 0) - Date.now()) / 1000)); return <main className="app-shell"><Header user={user} logout={() => { }} /><button className="back" onClick={leave}>← Leave room</button><section className="lobby-hero"><span className="pill">ROOM #{room.roomId}</span><h1>{room.roomName}</h1><p>{room.players.length}/{room.maxPlayers} players • {all ? 'Everyone is ready — host can start!' : 'Waiting for everyone to be ready'}</p></section>{notice && <div className="notice">{notice}</div>}<div className="lobby-grid"><section className="panel"><h2>Players</h2>{room.players.map(p => <div className="person" key={p.userId}><div className="avatar">{p.username[0]?.toUpperCase()}</div><b>{p.username}{String(p.userId) === String(user._id) && <small> YOU</small>}{String(p.userId) === String(room.hostId) && <small> HOST</small>}</b><span className={p.ready ? 'ready-badge' : 'wait-badge'}>{p.ready ? 'READY' : 'WAITING'}</span></div>)}<button className={me?.ready ? 'secondary wide' : 'primary wide'} onClick={ready}>{me?.ready ? 'Cancel ready' : 'Ready'}</button>{host && <button className="start wide" disabled={!all} onClick={start}>▶ Host Start Match</button>}</section><section className="panel"><h2>Invite online players</h2><p className="muted">Each player can be invited again after 30 seconds.</p>{available.length ? available.map(p => { const left = cooldown(p.userId); return <div className="person" key={p.userId}><div className="avatar">{p.username[0]?.toUpperCase()}</div><b>{p.username}</b><button className="invite" disabled={left > 0 || room.players.length >= room.maxPlayers} onClick={() => invite(p.userId)}>{left > 0 ? `Invite again in ${left}s` : 'Invite'}</button></div> }) : <div className="empty">No online players available.</div>}</section></div><InviteModal invites={invites} respond={respond} /></main> }
function InviteModal({ invites, respond }) { return <AnimatePresence>{invites.map(i => <motion.div className="modal-wrap" key={i.inviteId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="invite-modal" initial={{ scale: .9, y: 20 }} animate={{ scale: 1, y: 0 }}><span className="pill">ROOM INVITE</span><h2>{i.inviter?.username} invited you</h2><p>Join <b>{i.roomName}</b> now?</p><div className="modal-actions"><button className="secondary" onClick={() => respond(i, false)}>Reject</button><button className="primary" onClick={() => respond(i, true)}>Accept & Join</button></div></motion.div></motion.div>)}</AnimatePresence> }
function Play({ user, game, room, board, setBoard, submit, leave, rematch, notice }) {
  const size = game.boardSize, me = game.players.find(p => String(p.userId) === String(user._id)), setup = game.status === 'BOARD_SETUP', mine = board || Array.from({ length: size }, () => Array(size).fill('')); const random = () => { const a = Array.from({ length: size * size }, (_, i) => i + 1); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } setBoard(Array.from({ length: size }, (_, r) => a.slice(r * size, r * size + size).map(String))) }; const edit = (idx, val) => { const v = val.replace(/\D/g, '').slice(0, String(size * size).length); const flat = mine.flat(); flat[idx] = v; setBoard(Array.from({ length: size }, (_, r) => flat.slice(r * size, r * size + size))); }; const key = (e, i) => { let next = null, r = Math.floor(i / size), c = i % size; if (e.key === 'ArrowRight') next = c < size - 1 ? i + 1 : i; else if (e.key === 'ArrowLeft') next = c ? i - 1 : i; else if (e.key === 'ArrowDown') next = r < size - 1 ? i + size : i; else if (e.key === 'ArrowUp') next = r ? i - size : i; else if (e.key === 'Enter') next = Math.min(size * size - 1, i + 1); if (next !== null) { e.preventDefault(); document.querySelector(`[data-cell="${next}"]`)?.focus() } }; const called = new Set(game.calledNumbers || []);
  const s = window.__bingoSocket;
  const doCall = v => s?.emit('game:numberCall', { gameId: game.gameId, number: Number(v) });
  return <main className="app-shell"><Header user={user} logout={() => { }} /><button className="back" onClick={leave}>← Exit game</button><section className="game-head"><div><span className="pill">{setup ? 'SET UP YOUR BOARD' : 'LIVE MATCH'}</span><h1>{room.roomName}</h1><p>{setup ? `${game.players.filter(p => p.ready).length}/${game.players.length} boards ready` : game.currentTurn === String(user._id) ? 'Your turn — choose a number' : 'Opponent is choosing...'}</p></div><div className="score-strip">{game.players.map(p => <div key={p.userId}><b>{p.username}</b><span>{p.completedLines || 0} lines</span></div>)}</div></section>{notice && <div className="notice">{notice}</div>}<section className="game-layout"><div className="panel board-panel">{setup && !me?.ready && <button className="random" onClick={random}>⚡ Set random numbers</button>}<div className="bingo-board" style={{ gridTemplateColumns: `repeat(${size},1fr)` }}>{mine.flat().map((v, i) => { const n = Number(v), dup = v && mine.flat().filter(x => x === v).length > 1, bad = v && (!Number.isInteger(n) || n < 1 || n > size * size); const cell = me?.board?.flat?.()[i]; const marked = cell?.marked || called.has(n); return setup ? <input key={i} data-cell={i} className={dup || bad ? 'bad' : ''} value={v} onChange={e => edit(i, e.target.value)} onKeyDown={e => key(e, i)} disabled={me?.ready} /> : <button key={i} className={marked ? 'marked' : ''} disabled={game.currentTurn !== String(user._id) || called.has(n)} onClick={() => doCall(v)}>{v}{marked && <i>✓</i>}</button> })}</div>{setup && !me?.ready && <button className="primary wide" onClick={submit}>✓ Ready — Submit My Board</button>}{setup && me?.ready && <div className="waiting">✓ Board locked. Waiting for other players...</div>}</div><aside className="panel match-panel"><h2>Match status</h2><p>Called numbers appear green on every player's board.</p><div className="called-list">{(game.calledNumbers || []).slice(-24).map(n => <span key={n}>{n}</span>)}</div><div className="turn-card">{setup ? 'Set every number once.' : game.currentTurn === String(user._id) ? 'YOUR TURN' : 'WAIT FOR TURN'}</div></aside></section>{game.status === 'FINISHED' && <Result game={game} user={user} leave={leave} rematch={rematch} />}</main>
}
function Result({ game, user, leave, rematch }) {
  const me = game.players.find(p => String(p.userId) === String(user._id));
  const draw = game.players.some(p => p.status === 'DRAW');
  const win = me?.rank === 1;
  const title = win ? 'YOU WIN!' : draw ? 'DRAW' : 'YOU LOST';
  const icon = win ? '🏆' : draw ? '🤝' : '💫';
  const bingoLetters = ['B', 'I', 'N', 'G', 'O'];
  const confetti = Array.from({ length: 34 }, (_, i) => i);
  return <div className={`modal-wrap ${win ? 'winner-modal' : ''}`}>
    {win && <>
      <style>{`
        .winner-celebration{position:relative;width:min(980px,96vw);min-height:180px;display:flex;align-items:center;justify-content:center;pointer-events:none;margin:-18px auto 4px;overflow:visible}
        .winner-bingo{display:flex;justify-content:center;align-items:center;gap:clamp(2px,.8vw,12px);position:relative;z-index:4;filter:drop-shadow(0 18px 32px rgba(34,197,94,.28))}
        .winner-bingo-letter{display:inline-block;font-size:clamp(4.5rem,15vw,10rem);font-weight:1000;line-height:.82;letter-spacing:-.08em;background:linear-gradient(180deg,#ecfff5 0%,#5eead4 32%,#22c55e 72%,#15803d 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 10px 35px rgba(34,197,94,.28);animation:bingoWinnerLetter 1.05s cubic-bezier(.2,.9,.2,1) both infinite alternate}
        .winner-bingo-letter:nth-child(2){animation-delay:.08s}.winner-bingo-letter:nth-child(3){animation-delay:.16s}.winner-bingo-letter:nth-child(4){animation-delay:.24s}.winner-bingo-letter:nth-child(5){animation-delay:.32s}
        .winner-ring{position:absolute;width:min(540px,72vw);aspect-ratio:1;border:2px solid rgba(52,211,153,.24);border-radius:50%;box-shadow:0 0 80px rgba(34,197,94,.14),inset 0 0 80px rgba(34,197,94,.08);animation:bingoWinnerRing 2.8s ease-out infinite}
        .winner-ring:before,.winner-ring:after{content:'';position:absolute;inset:12%;border:1px solid rgba(94,234,212,.16);border-radius:50%;animation:bingoWinnerRing 2.8s ease-out infinite reverse}.winner-ring:after{inset:25%;animation-delay:.35s}
        .winner-confetti{position:absolute;inset:-15% -3%;overflow:hidden;z-index:3;pointer-events:none}
        .winner-confetti i{position:absolute;top:-30px;width:8px;height:18px;border-radius:3px;background:#4ade80;opacity:.9;animation:bingoConfetti 2.5s linear infinite}
        .winner-confetti i:nth-child(3n){background:#5eead4;width:6px;height:12px}.winner-confetti i:nth-child(4n){background:#facc15;width:9px;height:9px;border-radius:50%}.winner-confetti i:nth-child(5n){background:#fff;width:5px;height:16px}
        @keyframes bingoWinnerLetter{0%{transform:translateY(12px) scale(.84) rotate(-4deg);opacity:.62}55%{transform:translateY(-8px) scale(1.08) rotate(2deg);opacity:1}100%{transform:translateY(0) scale(1) rotate(0);opacity:.96}}
        @keyframes bingoWinnerRing{0%{transform:scale(.72);opacity:0}25%{opacity:.8}100%{transform:scale(1.22);opacity:0}}
        @keyframes bingoConfetti{0%{transform:translate3d(0,-30px,0) rotate(0);opacity:0}12%{opacity:1}100%{transform:translate3d(calc((var(--x) - 50) * 1vw),420px,0) rotate(620deg);opacity:0}}
        .winner-confetti i:nth-child(1){left:3%;--x:-12;animation-delay:.1s}.winner-confetti i:nth-child(2){left:8%;--x:18;animation-delay:.7s}.winner-confetti i:nth-child(3){left:14%;--x:-20;animation-delay:.35s}.winner-confetti i:nth-child(4){left:20%;--x:24;animation-delay:1.1s}.winner-confetti i:nth-child(5){left:27%;--x:-15;animation-delay:.5s}.winner-confetti i:nth-child(6){left:33%;--x:20;animation-delay:1.4s}.winner-confetti i:nth-child(7){left:39%;--x:-18;animation-delay:.2s}.winner-confetti i:nth-child(8){left:45%;--x:15;animation-delay:.9s}.winner-confetti i:nth-child(9){left:51%;--x:-22;animation-delay:.45s}.winner-confetti i:nth-child(10){left:57%;--x:18;animation-delay:1.25s}.winner-confetti i:nth-child(11){left:63%;--x:-16;animation-delay:.65s}.winner-confetti i:nth-child(12){left:69%;--x:22;animation-delay:.15s}.winner-confetti i:nth-child(13){left:75%;--x:-20;animation-delay:1.05s}.winner-confetti i:nth-child(14){left:81%;--x:16;animation-delay:.3s}.winner-confetti i:nth-child(15){left:87%;--x:-24;animation-delay:.8s}.winner-confetti i:nth-child(16){left:93%;--x:12;animation-delay:1.5s}.winner-confetti i:nth-child(17){left:6%;--x:25;animation-delay:1.8s}.winner-confetti i:nth-child(18){left:18%;--x:-25;animation-delay:1.6s}.winner-confetti i:nth-child(19){left:30%;--x:20;animation-delay:2s}.winner-confetti i:nth-child(20){left:42%;--x:-18;animation-delay:1.9s}.winner-confetti i:nth-child(21){left:54%;--x:24;animation-delay:1.7s}.winner-confetti i:nth-child(22){left:66%;--x:-20;animation-delay:2.1s}.winner-confetti i:nth-child(23){left:78%;--x:18;animation-delay:1.55s}.winner-confetti i:nth-child(24){left:90%;--x:-15;animation-delay:2.2s}.winner-confetti i:nth-child(25){left:11%;--x:17;animation-delay:2.4s}.winner-confetti i:nth-child(26){left:24%;--x:-18;animation-delay:2.15s}.winner-confetti i:nth-child(27){left:36%;--x:22;animation-delay:2.3s}.winner-confetti i:nth-child(28){left:48%;--x:-22;animation-delay:2.5s}.winner-confetti i:nth-child(29){left:60%;--x:19;animation-delay:2.35s}.winner-confetti i:nth-child(30){left:72%;--x:-17;animation-delay:2.55s}.winner-confetti i:nth-child(31){left:84%;--x:21;animation-delay:2.45s}.winner-confetti i:nth-child(32){left:96%;--x:-19;animation-delay:2.6s}.winner-confetti i:nth-child(33){left:16%;--x:12;animation-delay:2.7s}.winner-confetti i:nth-child(34){left:88%;--x:-12;animation-delay:2.8s}
        @media(prefers-reduced-motion:reduce){.winner-bingo-letter,.winner-ring,.winner-ring:before,.winner-ring:after,.winner-confetti i{animation:none!important}.winner-bingo-letter{transform:none!important;opacity:1}}
      `}</style>
      <div className="winner-celebration" aria-label="BINGO celebration">
        <div className="winner-ring" />
        <div className="winner-confetti">{confetti.map(i => <i key={i} />)}</div>
        <div className="winner-bingo">{bingoLetters.map((letter, i) => <motion.span key={letter} className="winner-bingo-letter" initial={{ scale: .3, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ delay: i * .12, type: 'spring', stiffness: 240, damping: 12 }}>{letter}</motion.span>)}</div>
      </div>
    </>}
    <motion.div className={`result ${win ? 'result-winner' : ''}`} initial={{ scale: .85, opacity: 0, y: 18 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 18 }}>
      <div className="trophy">{icon}</div>
      <h1>{title}</h1>
      <p>Your score: <b>{me?.points || 0}</b></p>
      <div className="result-actions"><button className="primary" onClick={rematch}>↻ Rematch</button><button className="secondary" onClick={leave}>Exit</button></div>
    </motion.div>
  </div>
}
export default App;
