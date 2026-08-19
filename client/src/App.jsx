import "./board-v8.css";
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
  const submit = async e => { e.preventDefault(); setError(""); try { const data = await api(mode === "login" ? "/auth/login" : "/auth/register", { method: "POST", body: JSON.stringify(form) }); localStorage.setItem("bingo_token", data.token); onLogin(data.user) } catch (err) { setError(err.message) } };
  return <div className="auth-page"><DecorativeAnimals/><div className="auth-card"><div className="brand-small"><span>B</span><b>BINGO</b></div><h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2><p className="muted">Play real-time multiplayer Bingo with friends.</p><form onSubmit={submit}>{mode === "register" && <input placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />}<input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /><div className="password-wrap"><input type={form.showPassword ? "text" : "password"} placeholder="Password (6+ characters)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength="6" required /><button type="button" className="show-pass" onClick={() => setForm({ ...form, showPassword: !form.showPassword })}>{form.showPassword ? "Hide" : "Show"}</button></div>{error && <div className="error">{error}</div>}<button className="primary" type="submit">{mode === "login" ? "Login" : "Register"}</button></form><button className="link-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}>{mode === "login" ? "Create an account" : "Already have an account? Login"}</button></div></div>
}

function Dashboard({user,onLogout}) {
  const [socket,setSocket]=useState(null),[room,setRoom]=useState(null),[game,setGame]=useState(null);
  const [roomName,setRoomName]=useState("Friends Room"),[password,setPassword]=useState("123456"),[maxPlayers,setMaxPlayers]=useState(4);
  const [joinId,setJoinId]=useState(""),[joinPassword,setJoinPassword]=useState(""),[message,setMessage]=useState(""),[board,setBoard]=useState(null);
  const [onlinePlayers,setOnlinePlayers]=useState([]),[invites,setInvites]=useState([]),[sentInvites,setSentInvites]=useState([]),[showCreatePassword,setShowCreatePassword]=useState(false),[showJoinPassword,setShowJoinPassword]=useState(false);

  useEffect(()=>{
    const s=createSocket(); setSocket(s); window.__bingoSocket=s;
    s.on("error:message",e=>setMessage(e.message));
    const applyOnline=players=>setOnlinePlayers((players||[]).filter(p=>String(p.userId)!==String(user._id)));
    s.on("presence:list",e=>applyOnline(e.players));
    s.on("presence:update",e=>applyOnline(e.players));
    let presenceTimer;
    const refreshOnline=()=>api("/players/online").then(d=>applyOnline(d.players)).catch(()=>{});
    refreshOnline();
    presenceTimer=setInterval(refreshOnline,3000);
    s.on("room:update",e=>setRoom(e.room));
    s.on("room:invite",invite=>setInvites(prev=>prev.some(x=>x.inviteId===invite.inviteId)?prev:[invite,...prev]));
    s.on("room:invite:response",e=>{setMessage(e.message);setSentInvites([])});
    s.on("room:joined",e=>{setInvites(prev=>prev.filter(x=>x.inviteId!==e.inviteId));setRoom(e.room);setMessage(`Joined ${e.room.roomName} from invitation.`)});
    s.on("room:started",e=>{setRoom(e.room);setGame(e.game);setBoard(null);s.emit("game:join",{gameId:e.game.gameId})});
    s.on("game:state",e=>{
      setGame(e.game);
      const player=e.game.players.find(p=>p.userId===user._id);
      const serverBoard=player?.board;
      if(Array.isArray(serverBoard)&&serverBoard.length===e.game.boardSize){
        const normalized=serverBoard.map(row=>row.map(cell=>cell&&typeof cell==="object"&&"value" in cell?String(cell.value):String(cell??"")));
        setBoard(prev=>prev&&prev.length===e.game.boardSize?prev:normalized);
      }
    });
    s.on("game:move",e=>setGame(e.game));
    return()=>{clearInterval(presenceTimer);s.disconnect()};
  },[user._id]);

  const invitePlayer=targetUserId=>{
    if(!room||!socket)return;
    socket.emit("room:invite",{roomId:room.roomId,targetUserId});
    setSentInvites(prev=>prev.includes(String(targetUserId))?prev:[...prev,String(targetUserId)]);
  };
  const respondInvite=(invite,accept)=>{if(!socket)return;socket.emit(accept?"room:invite:accept":"room:invite:reject",{inviteId:invite.inviteId});setInvites(prev=>prev.filter(x=>x.inviteId!==invite.inviteId))};
  const create=async()=>{try{const d=await api("/rooms",{method:"POST",body:JSON.stringify({roomName,password,maxPlayers:Number(maxPlayers)})});setRoom(d.room);socket?.emit("room:join",{roomId:d.room.roomId});setMessage("Room created. Share the room ID with friends.")}catch(e){setMessage(e.message)}};
  const join=async()=>{try{const d=await api("/rooms/join",{method:"POST",body:JSON.stringify({roomId:joinId,password:joinPassword})});setRoom(d.room);socket?.emit("room:join",{roomId:d.room.roomId});setMessage("Joined room.")}catch(e){setMessage(e.message)}};
  const toggleReady=()=>socket?.emit("room:ready",{roomId:room.roomId,ready:!room.players.find(p=>p.userId===user._id)?.ready});
  const start=()=>socket?.emit("room:start",{roomId:room.roomId});
  const submitBoard=()=>{
    if(!game||!board||!socket)return;
    const size=game.boardSize,max=size*size,values=board.flat().map(Number);
    if(board.length!==size||board.some(r=>!Array.isArray(r)||r.length!==size)){setMessage("Please fill the complete board.");return}
    if(values.some(v=>!Number.isInteger(v)||v<1||v>max)){setMessage(`Use numbers from 1 to ${max}.`);return}
    if(new Set(values).size!==values.length){setMessage("Duplicate numbers are not allowed. Each number must be used once.");return}
    socket.emit("game:boardSubmit",{gameId:game.gameId,board:board.map(r=>r.map(Number))});
    setMessage("Board submitted. Waiting for the other player...");
  };
  const back=()=>setGame(null);
  const exit=()=>{socket?.emit("room:leave",{roomId:room?.roomId});setGame(null);setBoard(null);setRoom(null)};
  const rematch=()=>{socket?.emit("room:ready",{roomId:room?.roomId,ready:true});setGame(null);setBoard(null);setMessage("Rematch requested. Everyone must be ready before the next game starts.")};

  if(room&&game)return <Game user={user} room={room} game={game} board={board} setBoard={setBoard} submitBoard={submitBoard} onLogout={onLogout} onBack={back} onExit={exit} onRematch={rematch} invites={invites} respondInvite={respondInvite}/>;
  if(room)return <Lobby user={user} room={room} toggleReady={toggleReady} start={start} onLogout={onLogout} message={message} onBack={()=>{setRoom(null);setGame(null);setBoard(null)}} onlinePlayers={onlinePlayers} onInvite={invitePlayer} sentInvites={sentInvites} invites={invites} respondInvite={respondInvite}/>;
  return <div className="dashboard"><DecorativeAnimals/><header className="topbar"><div className="brand"><span>B</span><strong>BINGO</strong></div><div className="user-chip">{user.username}<small>{user.uid}</small><button onClick={onLogout}>Logout</button></div></header><main className="dash-content"><motion.section className="welcome" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}}><div><p className="eyebrow">MULTIPLAYER DASHBOARD</p><h1>Ready to play, {user.username}?</h1><p className="muted">Create a private room or join a friend's room.</p></div></motion.section>{message&&<div className="notice">{message}</div>}<section className="dashboard-grid"><div className="panel"><h3>Create a room</h3><input value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="Room name"/><div className="password-wrap room-password"><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Room password" type={showCreatePassword?"text":"password"}/><button type="button" className="show-pass" onClick={()=>setShowCreatePassword(v=>!v)}>{showCreatePassword?"Hide":"Show"}</button></div><select value={maxPlayers} onChange={e=>setMaxPlayers(e.target.value)}>{[2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} players — {BOARD_SIZE[n]}×{BOARD_SIZE[n]}</option>)}</select><button className="primary" onClick={create}>Create private room</button></div><div className="panel"><h3>Join a room</h3><input value={joinId} onChange={e=>setJoinId(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" maxLength={6} placeholder="Room ID (6 digits)"/><div className="password-wrap room-password"><input value={joinPassword} onChange={e=>setJoinPassword(e.target.value)} placeholder="Password" type={showJoinPassword?"text":"password"}/><button type="button" className="show-pass" onClick={()=>setShowJoinPassword(v=>!v)}>{showJoinPassword?"Hide":"Show"}</button></div><button className="secondary" onClick={join}>Join room</button></div></section><section className="online-panel panel"><div className="online-head"><div><h3>Online players</h3><p className="muted">These players are online. Create a room to invite them.</p></div><span className="online-count">{onlinePlayers.length} ONLINE</span></div><div className="online-list">{onlinePlayers.length?onlinePlayers.map(p=><div className="online-row" key={p.userId}><span className="online-dot"/><div><b>{p.username}</b><small>{p.uid}</small></div><span className="online-state">ONLINE</span></div>):<div className="empty-online">No other players are online right now.</div>}</div></section></main>{invites.length>0&&<div className="invite-stack">{invites.map(inv=><motion.div key={inv.inviteId} className="invite-card" initial={{opacity:0,x:30,scale:.96}} animate={{opacity:1,x:0,scale:1}}><div className="invite-icon">✉</div><div className="invite-copy"><b>{inv.inviter.username} invited you</b><span>{inv.roomName}</span><small>Room {inv.roomId}</small></div><div className="invite-actions"><button className="primary" onClick={()=>respondInvite(inv,true)}>Accept</button><button className="secondary" onClick={()=>respondInvite(inv,false)}>Reject</button></div></motion.div>)}</div>}</div>
}
function InviteOverlay({invites,respondInvite}){
  if(!invites?.length)return null;
  return <div className="invite-stack">{invites.map(inv=><motion.div key={inv.inviteId} className="invite-card" initial={{opacity:0,x:30,scale:.96}} animate={{opacity:1,x:0,scale:1}}><div className="invite-icon">✉</div><div className="invite-copy"><b>{inv.inviter.username} invited you</b><span>{inv.roomName}</span><small>Room {inv.roomId}</small></div><div className="invite-actions"><button className="primary" onClick={()=>respondInvite(inv,true)}>Accept</button><button className="secondary" onClick={()=>respondInvite(inv,false)}>Reject</button></div></motion.div>)}</div>;
}

function Lobby({user,room,toggleReady,start,onLogout,message,onBack,onlinePlayers,onInvite,sentInvites,invites,respondInvite}){
  const me=room.players.find(p=>p.userId===user._id);
  return <div className="dashboard"><DecorativeAnimals/><header className="topbar"><div className="brand"><span>B</span><strong>BINGO</strong></div><button className="ghost" onClick={onBack}>← Back</button><button className="ghost" onClick={onLogout}>Logout</button></header><main className="lobby"><div className="room-head"><div><p className="eyebrow">PRIVATE ROOM</p><h1>{room.roomName}</h1><div className="room-id">ROOM <b>{room.roomId}</b></div></div></div>{message&&<div className="notice">{message}</div>}<div className="player-grid">{room.players.map(p=><motion.div className={`player-card ${p.ready?"ready":""}`} key={p.userId} layout><div className="avatar">{p.username.slice(0,1).toUpperCase()}</div><div><b>{p.username}</b><small>{p.userId===room.hostId?"HOST":"PLAYER"}</small></div><span className="ready-pill">{p.ready?"READY":"WAITING"}</span></motion.div>)}</div><section className="invite-panel panel"><div className="online-head"><div><h3>Invite online players</h3><p className="muted">Invite online players to this room. They can Accept or Reject.</p></div><span className="online-count">{onlinePlayers.filter(p=>!room.players.some(r=>r.userId===p.userId)).length} AVAILABLE</span></div><div className="online-list">{onlinePlayers.filter(p=>!room.players.some(r=>r.userId===p.userId)).length?onlinePlayers.filter(p=>!room.players.some(r=>r.userId===p.userId)).map(p=><motion.div className="online-row invite-row" key={p.userId} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}><span className="online-dot"/><div><b>{p.username}</b><small>{p.uid}</small></div><span className="online-state">ONLINE</span><button className="primary invite-btn" disabled={room.players.length>=room.maxPlayers||sentInvites?.includes?.(String(p.userId))} onClick={()=>onInvite(p.userId)}>{sentInvites?.includes?.(String(p.userId))?"Invited":"Invite"}</button></motion.div>):<div className="empty-online">No other online players available.</div>}</div></section><div className="lobby-actions"><button className={me?.ready?"secondary":"primary"} onClick={toggleReady}>{me?.ready?"Not ready":"I'm ready"}</button>{room.hostId===user._id&&<button className="primary" disabled={room.players.length<2||!room.players.every(p=>p.ready)} onClick={start}>Start game</button>}</div></main><InviteOverlay invites={invites} respondInvite={respondInvite}/></div>
}
function DecorativeAnimals(){
  const animals=["🐼","🐰","🦊","🐨","🐸","🐯","🐱","🐹"];
  return <div className="animal-field" aria-hidden="true">{animals.map((x,i)=><motion.span key={i} style={{"--i":i}} animate={{y:[0,-10,0],rotate:[-4,4,-4]}} transition={{duration:3+i*.2,repeat:Infinity,delay:i*.15,ease:"easeInOut"}}>{x}</motion.span>)}</div>;
}

function ResultScreen({user,game,onRematch,onExit}){
  const me=game.players.find(p=>p.userId===user._id);
  const type=me?.status==="DRAW"?"DRAW":me?.status==="RANKED"?"WIN":"LOSS";
  const icon=type==="WIN"?"🏆":type==="DRAW"?"🤝":"💫";
  const title=type==="WIN"?"YOU WIN!":type==="DRAW"?"DRAW!":"YOU LOST";
  const sub=type==="WIN"?`You finished #${me?.rank||1}`:type==="DRAW"?"The match ended in a draw.":"Better luck next round!";
  return <motion.div className={`result-screen result-${type.toLowerCase()}`} initial={{opacity:0}} animate={{opacity:1}}><DecorativeAnimals/><motion.div className="result-card-main" initial={{scale:.75,y:30}} animate={{scale:1,y:0}} transition={{type:"spring",stiffness:170,damping:15}}><motion.div className="result-icon" animate={{y:[0,-8,0],rotate:[-4,4,-4]}} transition={{duration:2,repeat:Infinity}}>{icon}</motion.div><span className="result-kicker">MATCH COMPLETE</span><h1>{title}</h1><p>{sub}</p><div className="result-score"><b>{me?.points??0}</b><span>POINTS</span></div><div className="result-mini-grid"><div><b>{me?.completedLines??0}</b><span>LINES</span></div><div><b>{me?.rank?`#${me.rank}`:"—"}</b><span>RANK</span></div><div><b>{me?.status||"—"}</b><span>STATUS</span></div></div><div className="result-actions"><button className="primary" onClick={onRematch}>↻ REMATCH</button><button className="secondary" onClick={onExit}>✕ EXIT</button></div><div className="result-board"><b>FINAL SCOREBOARD</b>{[...game.players].sort((a,b)=>(a.rank||99)-(b.rank||99)).map(p=><div key={p.userId}><span>{p.rank?`#${p.rank}`:"•"}</span><b>{p.username}</b><em>{p.status}</em><strong>{p.points} pts</strong></div>)}</div></motion.div></motion.div>;
}

function Game({user,room,game,board,setBoard,submitBoard,onLogout,onBack,onExit,onRematch,invites,respondInvite}){
  const size=game.boardSize,maxNumber=size*size,my=game.players.find(p=>p.userId===user._id);
  const isSetup=game.status==="BOARD_SETUP",isWaiting=isSetup&&Boolean(my?.ready),isMyTurn=game.currentTurn===user._id;
  const localBoard=useMemo(()=>board?.length===size?board:Array.from({length:size},()=>Array(size).fill("")),[board,size]);
  const [activeCell,setActiveCell]=useState(0);
  const counts=useMemo(()=>{const m={};localBoard.flat().forEach(v=>{if(v!=="")m[String(v)]=(m[String(v)]||0)+1});return m},[localBoard]);

  if(game.status==="FINISHED")return <ResultScreen user={user} game={game} onRematch={onRematch} onExit={onExit}/>;
  const changeCell=(r,c,val)=>{if(!isSetup||isWaiting)return;const digits=String(val).replace(/\D/g,"").slice(0,String(maxNumber).length);const clean=digits===""?"":String(Number(digits));const next=localBoard.map(row=>[...row]);next[r][c]=clean;setBoard(next)};
  const focusCell=index=>{const n=Math.max(0,Math.min(size*size-1,index));setActiveCell(n);requestAnimationFrame(()=>document.querySelector(`[data-cell="${n}"]`)?.focus())};
  const onKey=(e,index)=>{if(e.key==="Enter"){e.preventDefault();focusCell(index+1)}};
  const call=n=>{if(!isMyTurn||game.status!=="PLAYING")return;const number=Number(n);if(Number.isInteger(number)&&number>=1&&number<=maxNumber&&!game.calledNumbers.includes(number))window.__bingoSocket?.emit("game:numberCall",{gameId:game.gameId,number})};

  return <div className="game-page"><DecorativeAnimals/><header className="topbar"><div className="brand"><span>B</span><strong>BINGO</strong></div><div className="game-head-actions"><button className="ghost" onClick={onBack}>← Back</button><div className={`turn ${isMyTurn&&!isSetup?"my":""}`}>{isWaiting?"WAITING FOR PLAYER":isSetup?"ENTER YOUR BOARD":isMyTurn?"YOUR TURN":"WAITING FOR CALL"}</div><button className="ghost" onClick={onLogout}>Logout</button></div></header><main className="game-layout"><section className="board-panel"><div className="game-title"><div><p className="eyebrow">{room.roomId} · {game.playerCount} PLAYERS</p><h2>BINGO {size}×{size}</h2></div><div className="progress"><b>{my?.completedLines||0}/{game.requiredLines}</b><span>LINES</span></div></div><p className="muted">{isWaiting?"BOARD SAVED ✓ — WAITING FOR OTHER PLAYER TO SUBMIT":isSetup?`Use 1–${maxNumber}. Duplicate numbers turn red immediately. Press Enter to move.`:isMyTurn?"YOUR TURN — click a number on your board to call it.":"WAITING — opponent calls appear green on your board."}</p><div className={`bingo-board ${isSetup?"editing":"play-board"} ${isWaiting?"waiting-board":""}`} style={{"--size":size}}>{localBoard.map((row,r)=>row.map((value,c)=>{const idx=r*size+c,number=Number(value),invalid=isSetup&&value!==""&&(!Number.isInteger(number)||number<1||number>maxNumber),duplicate=isSetup&&value!==""&&counts[String(value)]>1,marked=Boolean(my?.board?.[r]?.[c]?.marked);if(!isSetup)return <button key={idx} type="button" className={`bingo-cell play-cell ${marked?"marked":""}`} onClick={()=>call(number)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();call(number)}}} disabled={!isMyTurn||!Number.isInteger(number)||number<1||number>maxNumber||game.calledNumbers.includes(number)}><span>{value}</span>{marked&&<i className="cell-check">✓</i>}</button>;return <input key={idx} data-cell={idx} className={`bingo-cell ${invalid?"invalid-number":""} ${duplicate?"duplicate-number":""}`} value={value??""} inputMode="numeric" maxLength={String(maxNumber).length} onFocus={()=>setActiveCell(idx)} onKeyDown={e=>onKey(e,idx)} onChange={e=>changeCell(r,c,e.target.value)} disabled={isWaiting} aria-label={`row ${r+1} column ${c+1}`}/>; }))}</div>{isSetup&&<button className="primary wide ready-submit" disabled={isWaiting} onClick={submitBoard}>{isWaiting?"✓ BOARD READY — WAITING FOR PLAYER":"✓ READY — SUBMIT MY BOARD"}</button>}</section><aside className="side-panel"><h3>Players</h3>{game.players.map(p=><div className={`game-player ${p.userId===game.currentTurn?"active":""}`} key={p.userId}><div className="avatar small">{p.username.slice(0,1).toUpperCase()}</div><div className="gp-name"><b>{p.username}{p.userId===user._id?" (You)":""}</b><span>{p.status}</span></div><div className="gp-score">{p.completedLines}<small>lines</small></div></div>)}<div className="called"><h3>Called numbers</h3><div className="called-list">{game.calledNumbers.length?game.calledNumbers.map(n=><span key={n}>{n}</span>):<small className="muted">No numbers called yet.</small>}</div></div></aside></main><InviteOverlay invites={invites} respondInvite={respondInvite}/></div>;
}
export default function App() { const [user, setUser] = useState(null); useEffect(() => { if (localStorage.getItem("bingo_token")) api("/auth/me").then(d => setUser(d.user)).catch(() => localStorage.removeItem("bingo_token")) }, []); const logout = () => { localStorage.removeItem("bingo_token"); setUser(null) }; return user ? <Dashboard user={user} onLogout={logout} /> : <Auth onLogin={setUser} /> }
