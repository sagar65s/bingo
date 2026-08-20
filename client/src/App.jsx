import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "./services/api";
import { createSocket } from "./socket/socket";
import { BOARD_SIZE } from "./utils/game";
import "./board-v8.css";

const animals = ["🐼", "🐰", "🦊", "🐨", "🐸", "🐯", "🐱", "🐹", "🐻", "🐙"];

function DecorativeAnimals() {
  return (
    <div className="animal-field" aria-hidden="true">
      {animals.map((a, i) => (
        <motion.span
          key={i}
          style={{ "--i": i }}
          animate={{
            y: [0, -9, 0],
            rotate: [-4, 4, -4],
          }}
          transition={{
            duration: 3 + i * 0.18,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        >
          {a}
        </motion.span>
      ))}
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  show,
  setShow,
  placeholder,
}) {
  return (
    <div className="password-wrap room-password">
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={show ? "text" : "password"}
      />

      <button
        type="button"
        className="show-pass"
        onClick={() => setShow((v) => !v)}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    showPassword: false,
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setError("");
    setBusy(true);

    try {
      const data = await api(
        mode === "login"
          ? "/auth/login"
          : "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(form),
        }
      );

      localStorage.setItem("bingo_token", data.token);

      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <DecorativeAnimals />

      <motion.div
        className="auth-card"
        initial={{
          opacity: 0,
          y: 30,
          scale: 0.96,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
      >
        <div className="brand-small">
          <span>B</span>
          <b>BINGO</b>
        </div>

        <h1>
          {mode === "login"
            ? "Welcome back"
            : "Create your account"}
        </h1>

        <p className="muted">
          Play real-time multiplayer Bingo with friends.
        </p>

        <form onSubmit={submit}>
          {mode === "register" && (
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) =>
                setForm({
                  ...form,
                  username: e.target.value,
                })
              }
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
            required
          />

          <div className="password-wrap">
            <input
              type={
                form.showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Password (6+ characters)"
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value,
                })
              }
              minLength={6}
              required
            />

            <button
              type="button"
              className="show-pass"
              onClick={() =>
                setForm({
                  ...form,
                  showPassword: !form.showPassword,
                })
              }
            >
              {form.showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <button
            className="primary wide"
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Login"
                : "Register"}
          </button>
        </form>

        <button
          className="link-button"
          onClick={() => {
            setMode(
              mode === "login"
                ? "register"
                : "login"
            );

            setError("");
          }}
        >
          {mode === "login"
            ? "Create an account"
            : "Already have an account? Login"}
        </button>
      </motion.div>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const socketRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [board, setBoard] = useState(null);
  const [message, setMessage] = useState("");

  const [roomName, setRoomName] =
    useState("Friends Room");

  const [password, setPassword] =
    useState("123456");

  const [maxPlayers, setMaxPlayers] =
    useState(4);

  const [joinId, setJoinId] =
    useState("");

  const [joinPassword, setJoinPassword] =
    useState("");

  const [
    showCreatePassword,
    setShowCreatePassword,
  ] = useState(false);

  const [
    showJoinPassword,
    setShowJoinPassword,
  ] = useState(false);

  const [
    onlinePlayers,
    setOnlinePlayers,
  ] = useState([]);

  const [invites, setInvites] =
    useState([]);

  const [sentInvites, setSentInvites] =
    useState([]);

  const [rematchInfo, setRematchInfo] =
    useState(null);

  const getSocket = () => socketRef.current;

  useEffect(() => {
    const s = createSocket();

    socketRef.current = s;
    window.__bingoSocket = s;

    const applyOnline = (players) => {
      setOnlinePlayers(
        (players || []).filter(
          (p) =>
            String(p.userId) !==
            String(user._id)
        )
      );
    };

    const refreshOnline = () => {
      api("/players/online")
        .then((d) => applyOnline(d.players))
        .catch(() => {});
    };

    const joinSocket = (roomId) => {
      if (s.connected) {
        s.emit("room:join", {
          roomId,
        });
      } else {
        s.once("connect", () => {
          s.emit("room:join", {
            roomId,
          });
        });
      }
    };

    const syncGame = (e) => {
      if (!e?.game) return;

      setGame(e.game);

      const me = e.game.players?.find(
        (p) =>
          String(p.userId) ===
          String(user._id)
      );

      if (
        me?.board &&
        Array.isArray(me.board) &&
        me.board.length === e.game.boardSize
      ) {
        const normalized =
          me.board.map((row) =>
            row.map((cell) => {
              if (
                cell &&
                typeof cell === "object" &&
                "value" in cell
              ) {
                return String(cell.value);
              }

              return String(cell ?? "");
            })
          );

        setBoard(normalized);
      }
    };

    s.on("connect_error", (e) => {
      setMessage(
        e?.message ||
          "Connection lost. Reconnecting…"
      );
    });

    s.on("error:message", (e) => {
      setMessage(e?.message || "An error occurred.");
    });

    s.on("presence:list", (e) => {
      applyOnline(e.players);
    });

    s.on("presence:update", (e) => {
      applyOnline(e.players);
    });

    s.on("room:update", (e) => {
      if (e?.room) {
        setRoom(e.room);
      }
    });

    s.on("room:invite", (invite) => {
      if (!invite?.inviteId) return;

      setInvites((prev) =>
        prev.some(
          (x) =>
            x.inviteId ===
            invite.inviteId
        )
          ? prev
          : [invite, ...prev]
      );
    });

    s.on(
      "room:invite:response",
      (e) => {
        if (e?.message) {
          setMessage(e.message);
        }

        const targetId =
          e?.targetUserId ||
          e?.toUserId;

        if (targetId) {
          setSentInvites((prev) =>
            prev.filter(
              (playerId) =>
                String(playerId) !==
                String(targetId)
            )
          );
        }
      }
    );

    s.on("room:joined", (e) => {
      if (e?.inviteId) {
        setInvites((prev) =>
          prev.filter(
            (x) =>
              x.inviteId !==
              e.inviteId
          )
        );
      }

      if (e?.room) {
        setRoom(e.room);
      }

      setGame(null);
      setBoard(null);

      if (e?.room?.roomName) {
        setMessage(
          `Joined ${e.room.roomName}.`
        );
      }
    });

    s.on(
      "room:rematch:update",
      (e) => {
        setRematchInfo(e);
      }
    );

    s.on("room:started", (e) => {
      if (!e?.game) return;

      setRoom(e.room);
      setGame(e.game);
      setBoard(null);
      setRematchInfo(null);

      s.emit("game:join", {
        gameId: e.game.gameId,
      });
    });

    s.on("game:state", syncGame);
    s.on("game:move", syncGame);

    refreshOnline();

    const timer = setInterval(
      refreshOnline,
      30000
    );

    return () => {
      clearInterval(timer);

      s.removeAllListeners();
      s.disconnect();

      socketRef.current = null;

      if (window.__bingoSocket === s) {
        window.__bingoSocket = null;
      }
    };
  }, [user._id]);

  const joinRoomSocket = (roomId) => {
    const s = getSocket();

    if (!s) return;

    if (s.connected) {
      s.emit("room:join", {
        roomId,
      });
    } else {
      s.once("connect", () => {
        s.emit("room:join", {
          roomId,
        });
      });
    }
  };

  const create = async () => {
    try {
      const d = await api("/rooms", {
        method: "POST",
        body: JSON.stringify({
          roomName,
          password,
          maxPlayers: Number(maxPlayers),
        }),
      });

      setRoom(d.room);
      setGame(null);
      setBoard(null);

      joinRoomSocket(d.room.roomId);

      setMessage(
        `Room created. ID: ${d.room.roomId}`
      );
    } catch (e) {
      setMessage(e.message);
    }
  };

  const join = async () => {
    if (!/^\d{6}$/.test(joinId)) {
      setMessage(
        "Room ID must contain exactly 6 digits."
      );

      return;
    }

    try {
      const d = await api("/rooms/join", {
        method: "POST",
        body: JSON.stringify({
          roomId: joinId,
          password: joinPassword,
        }),
      });

      setRoom(d.room);
      setGame(null);
      setBoard(null);

      joinRoomSocket(d.room.roomId);

      setMessage(
        "Joined room. Waiting for the host/players."
      );
    } catch (e) {
      setMessage(e.message);
    }
  };

  const toggleReady = () => {
    const me = room?.players?.find(
      (p) =>
        String(p.userId) ===
        String(user._id)
    );

    getSocket()?.emit("room:ready", {
      roomId: room.roomId,
      ready: !me?.ready,
    });
  };

  const start = () => {
    getSocket()?.emit("room:start", {
      roomId: room.roomId,
    });
  };

  const leaveRoom = () => {
    if (room?.roomId) {
      getSocket()?.emit("room:leave", {
        roomId: room.roomId,
      });
    }

    setRoom(null);
    setGame(null);
    setBoard(null);
    setRematchInfo(null);

    setMessage("You left the room.");
  };

  const invitePlayer = (playerId) => {
    if (!room) return;

    const id = String(playerId);

    getSocket()?.emit("room:invite", {
      roomId: room.roomId,
      targetUserId: id,
    });

    setSentInvites((prev) =>
      prev.includes(id)
        ? prev
        : [...prev, id]
    );
  };

  const respondInvite = (
    invite,
    accept
  ) => {
    getSocket()?.emit(
      accept
        ? "room:invite:accept"
        : "room:invite:reject",
      {
        inviteId: invite.inviteId,
      }
    );

    setInvites((prev) =>
      prev.filter(
        (x) =>
          x.inviteId !==
          invite.inviteId
      )
    );
  };

  const submitBoard = () => {
    if (!game || !board) return;

    const size = game.boardSize;
    const max = size * size;

    if (
      board.length !== size ||
      board.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== size
      )
    ) {
      setMessage(
        "Please fill every box."
      );

      return;
    }

    const values =
      board.flat().map(Number);

    if (
      values.some(
        (value) =>
          !Number.isInteger(value) ||
          value < 1 ||
          value > max
      )
    ) {
      setMessage(
        `Use numbers from 1 to ${max}.`
      );

      return;
    }

    if (
      new Set(values).size !==
      values.length
    ) {
      setMessage(
        "Duplicate numbers are not allowed."
      );

      return;
    }

    getSocket()?.emit(
      "game:boardSubmit",
      {
        gameId: game.gameId,
        board: board.map((row) =>
          row.map(Number)
        ),
      }
    );

    setMessage(
      "Board submitted. Waiting for the other player…"
    );
  };

  const rematch = () => {
    setRematchInfo({
      count: 1,
      total: room?.players?.length || 2,
    });

    if (!room?.roomId) return;

    getSocket()?.emit(
      "room:rematch",
      {
        roomId: room.roomId,
      }
    );
  };

  if (room && game) {
    return (
      <Game
        user={user}
        room={room}
        game={game}
        board={board}
        setBoard={setBoard}
        submitBoard={submitBoard}
        onLogout={onLogout}
        onBack={leaveRoom}
        onExit={leaveRoom}
        onRematch={rematch}
        invites={invites}
        respondInvite={respondInvite}
        rematchInfo={rematchInfo}
      />
    );
  }

  if (room) {
    return (
      <Lobby
        user={user}
        room={room}
        toggleReady={toggleReady}
        start={start}
        onLogout={onLogout}
        message={message}
        onBack={leaveRoom}
        onlinePlayers={onlinePlayers}
        onInvite={invitePlayer}
        sentInvites={sentInvites}
        invites={invites}
        respondInvite={respondInvite}
      />
    );
  }

  return (
    <div className="dashboard">
      <DecorativeAnimals />

      <header className="topbar">
        <div className="brand">
          <span>B</span>
          <strong>BINGO</strong>
        </div>

        <div className="user-chip">
          <b>{user.username}</b>
          <small>{user.uid}</small>

          <button onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dash-content">
        <motion.section
          className="welcome"
          initial={{
            opacity: 0,
            y: 18,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <div>
            <p className="eyebrow">
              MULTIPLAYER DASHBOARD
            </p>

            <h1>
              Ready to play,
              {" "}
              {user.username}?
            </h1>

            <p className="muted">
              Create a private room or join
              a friend's room.
            </p>
          </div>

          <div className="stats">
            <div>
              <b>2–7</b>
              <span>Players</span>
            </div>

            <div>
              <b>5×5–10×10</b>
              <span>Boards</span>
            </div>
          </div>
        </motion.section>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}

        <section className="dashboard-grid">
          <div className="panel">
            <h3>Create a room</h3>

            <input
              value={roomName}
              onChange={(e) =>
                setRoomName(e.target.value)
              }
              placeholder="Room name"
            />

            <PasswordField
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              show={showCreatePassword}
              setShow={
                setShowCreatePassword
              }
              placeholder="Room password"
            />

            <select
              value={maxPlayers}
              onChange={(e) =>
                setMaxPlayers(
                  e.target.value
                )
              }
            >
              {[2, 3, 4, 5, 6, 7].map(
                (n) => (
                  <option
                    key={n}
                    value={n}
                  >
                    {n} players —{" "}
                    {BOARD_SIZE[n]}×
                    {BOARD_SIZE[n]}
                  </option>
                )
              )}
            </select>

            <button
              className="primary wide"
              onClick={create}
            >
              Create private room
            </button>
          </div>

          <div className="panel">
            <h3>Join a room</h3>

            <input
              value={joinId}
              onChange={(e) =>
                setJoinId(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6)
                )
              }
              inputMode="numeric"
              maxLength={6}
              placeholder="Room ID — 6 digits"
            />

            <PasswordField
              value={joinPassword}
              onChange={(e) =>
                setJoinPassword(
                  e.target.value
                )
              }
              show={showJoinPassword}
              setShow={
                setShowJoinPassword
              }
              placeholder="Room password"
            />

            <button
              className="secondary wide"
              onClick={join}
            >
              Join room
            </button>
          </div>
        </section>

        <section className="online-panel panel">
          <div className="online-head">
            <div>
              <h3>Online players</h3>

              <p className="muted">
                Refreshes automatically every
                30 seconds.
              </p>
            </div>

            <span className="online-count">
              {onlinePlayers.length} ONLINE
            </span>
          </div>

          <div className="online-list">
            {onlinePlayers.length ? (
              onlinePlayers.map((p) => (
                <div
                  className="online-row"
                  key={p.userId}
                >
                  <span className="online-dot" />

                  <div>
                    <b>{p.username}</b>
                    <small>{p.uid}</small>
                  </div>

                  <span className="online-state">
                    ONLINE
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-online">
                No other players are online
                right now.
              </div>
            )}
          </div>
        </section>
      </main>

      <InviteOverlay
        invites={invites}
        respondInvite={respondInvite}
      />
    </div>
  );
}

function InviteOverlay({
  invites,
  respondInvite,
}) {
  return (
    <AnimatePresence>
      {invites?.map((inv) => (
        <motion.div
          key={inv.inviteId}
          className="invite-card"
          initial={{
            opacity: 0,
            x: 30,
            scale: 0.95,
          }}
          animate={{
            opacity: 1,
            x: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            x: 30,
          }}
        >
          <div className="invite-icon">
            ✉
          </div>

          <div className="invite-copy">
            <b>
              {inv.inviter?.username ||
                "Player"}{" "}
              invited you
            </b>

            <span>{inv.roomName}</span>

            <small>
              Room {inv.roomId}
            </small>
          </div>

          <div className="invite-actions">
            <button
              className="primary"
              onClick={() =>
                respondInvite(
                  inv,
                  true
                )
              }
            >
              Accept
            </button>

            <button
              className="secondary"
              onClick={() =>
                respondInvite(
                  inv,
                  false
                )
              }
            >
              Reject
            </button>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function Lobby({
  user,
  room,
  toggleReady,
  start,
  onLogout,
  message,
  onBack,
  onlinePlayers,
  onInvite,
  sentInvites,
  invites,
  respondInvite,
}) {
  const me = room.players.find(
    (p) =>
      String(p.userId) ===
      String(user._id)
  );

  const allReady =
    room.players.length >= 2 &&
    room.players.every(
      (p) => p.ready
    );

  const available =
    onlinePlayers.filter(
      (p) =>
        !room.players.some(
          (r) =>
            String(r.userId) ===
            String(p.userId)
        )
    );

  return (
    <div className="dashboard">
      <DecorativeAnimals />

      <header className="topbar">
        <div className="brand">
          <span>B</span>
          <strong>BINGO</strong>
        </div>

        <div className="game-head-actions">
          <button
            className="ghost"
            onClick={onBack}
          >
            ← Back
          </button>

          <button
            className="ghost"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="lobby">
        <div className="room-head">
          <div>
            <p className="eyebrow">
              PRIVATE ROOM
            </p>

            <h1>{room.roomName}</h1>

            <div className="room-id">
              ROOM <b>{room.roomId}</b>
            </div>
          </div>

          <div className="room-rule">
            <b>
              {room.players.length}/
              {room.maxPlayers}
            </b>

            <span>Players</span>
          </div>
        </div>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}

        <div className="player-grid">
          {room.players.map((p) => (
            <motion.div
              className={`player-card ${
                p.ready
                  ? "ready"
                  : ""
              }`}
              key={p.userId}
              layout
            >
              <div className="avatar">
                {p.username
                  .slice(0, 1)
                  .toUpperCase()}
              </div>

              <div>
                <b>
                  {p.username}
                  {String(
                    p.userId
                  ) ===
                  String(user._id)
                    ? " (You)"
                    : ""}
                </b>

                <small>
                  {String(
                    p.userId
                  ) ===
                  String(room.hostId)
                    ? "HOST"
                    : "PLAYER"}
                </small>
              </div>

              <span className="ready-pill">
                {p.ready
                  ? "✓ READY"
                  : "WAITING"}
              </span>
            </motion.div>
          ))}
        </div>

        <section className="invite-panel panel">
          <div className="online-head">
            <div>
              <h3>
                Invite online players
              </h3>

              <p className="muted">
                Choose one particular online
                player. Only that player
                receives the request.
              </p>
            </div>

            <span className="online-count">
              {available.length} AVAILABLE
            </span>
          </div>

          <div className="online-list">
            {available.length ? (
              available.map((p) => (
                <div
                  className="online-row invite-row"
                  key={p.userId}
                >
                  <span className="online-dot" />

                  <div>
                    <b>{p.username}</b>
                    <small>{p.uid}</small>
                  </div>

                  <span className="online-state">
                    ONLINE
                  </span>

                  <button
                    className="primary invite-btn"
                    disabled={
                      sentInvites.includes(
                        String(p.userId)
                      ) ||
                      room.players.length >=
                        room.maxPlayers
                    }
                    onClick={() =>
                      onInvite(p.userId)
                    }
                  >
                    {sentInvites.includes(
                      String(p.userId)
                    )
                      ? "Invited"
                      : "Invite"}
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-online">
                No other online players
                available.
              </div>
            )}
          </div>
        </section>

        <div className="lobby-actions">
          <button
            className={
              me?.ready
                ? "secondary"
                : "primary"
            }
            onClick={toggleReady}
          >
            {me?.ready
              ? "✓ READY — Cancel"
              : "I'm ready"}
          </button>

          {room.hostId === user._id &&
            !allReady && (
              <button
                className="primary"
                disabled={
                  room.players.length < 2 ||
                  !allReady
                }
                onClick={start}
              >
                Start game
              </button>
            )}

          {allReady && (
            <div className="ready-all">
              ✓ Everyone ready — starting
              match…
            </div>
          )}
        </div>

        <p className="muted center">
          All players must be ready. The
          match starts automatically when
          everyone is ready.
        </p>
      </main>

      <InviteOverlay
        invites={invites}
        respondInvite={respondInvite}
      />
    </div>
  );
}

function ResultScreen({
  user,
  game,
  onRematch,
  onExit,
  rematchInfo,
}) {
  const me = game.players.find(
    (p) =>
      String(p.userId) ===
      String(user._id)
  );

  const type =
    me?.status === "DRAW"
      ? "DRAW"
      : me?.status === "RANKED"
        ? "WIN"
        : "LOSS";

  const icon =
    type === "WIN"
      ? "🏆"
      : type === "DRAW"
        ? "🤝"
        : "💫";

  const title =
    type === "WIN"
      ? "YOU WIN!"
      : type === "DRAW"
        ? "DRAW!"
        : "YOU LOST";

  return (
    <motion.div
      className={`result-screen result-${type.toLowerCase()}`}
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
    >
      <DecorativeAnimals />

      <motion.div
        className="result-card-main"
        initial={{
          scale: 0.8,
          y: 30,
        }}
        animate={{
          scale: 1,
          y: 0,
        }}
        transition={{
          type: "spring",
          stiffness: 160,
          damping: 14,
        }}
      >
        <motion.div
          className="result-icon"
          animate={{
            y: [0, -8, 0],
            rotate: [-4, 4, -4],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        >
          {icon}
        </motion.div>

        <span className="result-kicker">
          MATCH COMPLETE
        </span>

        <h1>{title}</h1>

        <p>
          {type === "WIN"
            ? `You finished #${me?.rank || 1}`
            : type === "DRAW"
              ? "The same move completed the winning state for multiple players."
              : "Better luck next round."}
        </p>

        <div className="result-score">
          <b>{me?.points || 0}</b>
          <span>POINTS</span>
        </div>

        <div className="result-mini-grid">
          <div>
            <b>
              {me?.completedLines || 0}
            </b>
            <span>LINES</span>
          </div>

          <div>
            <b>
              {me?.rank
                ? `#${me.rank}`
                : "—"}
            </b>
            <span>RANK</span>
          </div>

          <div>
            <b>
              {me?.status || "—"}
            </b>
            <span>STATUS</span>
          </div>
        </div>

        <div className="result-actions">
          <button
            className="primary"
            onClick={onRematch}
          >
            ↻ REMATCH
          </button>

          <button
            className="secondary"
            onClick={onExit}
          >
            ✕ EXIT
          </button>
        </div>

        {rematchInfo && (
          <div className="notice">
            Rematch ready:{" "}
            {rematchInfo.count}/
            {rematchInfo.total}.
            Waiting for everyone…
          </div>
        )}

        <div className="result-board">
          <b>FINAL SCOREBOARD</b>

          {[...game.players]
            .sort(
              (a, b) =>
                (a.rank ?? 999) -
                (b.rank ?? 999)
            )
            .map((p) => (
              <div key={p.userId}>
                <span>
                  {p.rank
                    ? `#${p.rank}`
                    : "•"}
                </span>

                <b>{p.username}</b>

                <em>{p.status}</em>

                <strong>
                  {p.points} pts
                </strong>
              </div>
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Game({
  user,
  room,
  game,
  board,
  setBoard,
  submitBoard,
  onLogout,
  onBack,
  onExit,
  onRematch,
  invites,
  respondInvite,
  rematchInfo,
}) {
  const size = game.boardSize;
  const max = size * size;

  const my = game.players.find(
    (p) =>
      String(p.userId) ===
      String(user._id)
  );

  const isSetup =
    game.status === "BOARD_SETUP";

  const isWaiting =
    isSetup && Boolean(my?.ready);

  const isMyTurn =
    String(game.currentTurn) ===
    String(user._id);

  const localBoard = useMemo(() => {
    if (
      board?.length === size
    ) {
      return board;
    }

    return Array.from(
      {
        length: size,
      },
      () =>
        Array(size).fill("")
    );
  }, [board, size]);

  const counts = useMemo(() => {
    const count = {};

    for (
      const value of localBoard.flat()
    ) {
      if (value !== "") {
        count[value] =
          (count[value] || 0) + 1;
      }
    }

    return count;
  }, [localBoard]);

  const focusCell = (index) => {
    const n = Math.max(
      0,
      Math.min(max - 1, index)
    );

    requestAnimationFrame(() => {
      const el =
        document.querySelector(
          `[data-cell="${n}"]`
        );

      el?.focus();
      el?.select?.();
    });
  };

  const change = (
    row,
    column,
    value
  ) => {
    if (!isSetup || isWaiting) return;

    const digits = String(value)
      .replace(/\D/g, "")
      .slice(
        0,
        String(max).length
      );

    const next = localBoard.map(
      (currentRow) =>
        [...currentRow]
    );

    next[row][column] = digits;

    setBoard(next);
  };

  const handleKey = (
    e,
    index
  ) => {
    let next = null;

    const row =
      Math.floor(index / size);

    const column =
      index % size;

    if (e.key === "Enter") {
      next = index + 1;
    } else if (
      e.key === "ArrowRight"
    ) {
      next =
        column < size - 1
          ? index + 1
          : index;
    } else if (
      e.key === "ArrowLeft"
    ) {
      next =
        column > 0
          ? index - 1
          : index;
    } else if (
      e.key === "ArrowDown"
    ) {
      next =
        row < size - 1
          ? index + size
          : index;
    } else if (
      e.key === "ArrowUp"
    ) {
      next =
        row > 0
          ? index - size
          : index;
    } else if (
      e.key === "Backspace" &&
      !localBoard[row][column]
    ) {
      next = index - 1;
    }

    if (next !== null) {
      e.preventDefault();

      focusCell(
        Math.max(
          0,
          Math.min(
            max - 1,
            next
          )
        )
      );
    }
  };

  const call = (number) => {
    if (
      !isMyTurn ||
      game.status !== "PLAYING"
    ) {
      return;
    }

    if (
      !Number.isInteger(number) ||
      number < 1 ||
      number > max ||
      game.calledNumbers.includes(number)
    ) {
      return;
    }

    window.__bingoSocket?.emit(
      "game:numberCall",
      {
        gameId: game.gameId,
        number,
      }
    );
  };

  if (
    game.status === "FINISHED"
  ) {
    return (
      <ResultScreen
        user={user}
        game={game}
        onRematch={onRematch}
        onExit={onExit}
        rematchInfo={rematchInfo}
      />
    );
  }

  return (
    <div className="game-page">
      <DecorativeAnimals />

      <header className="topbar">
        <div className="brand">
          <span>B</span>
          <strong>BINGO</strong>
        </div>

        <div className="game-head-actions">
          <button
            className="ghost"
            onClick={onBack}
          >
            ← Back
          </button>

          <div
            className={`turn ${
              isMyTurn && !isSetup
                ? "my"
                : ""
            }`}
          >
            {isWaiting
              ? "WAITING FOR PLAYER"
              : isSetup
                ? "ENTER YOUR BOARD"
                : isMyTurn
                  ? "YOUR TURN"
                  : "WAITING FOR CALL"}
          </div>

          <button
            className="ghost"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="game-layout">
        <section className="board-panel">
          <div className="game-title">
            <div>
              <p className="eyebrow">
                {room.roomId} ·{" "}
                {game.playerCount} PLAYERS
              </p>

              <h2>
                BINGO {size}×{size}
              </h2>
            </div>

            <div className="progress">
              <b>
                {my?.completedLines || 0}/
                {game.requiredLines}
              </b>

              <span>LINES</span>
            </div>
          </div>

          <p className="muted">
            {isWaiting
              ? "BOARD SAVED ✓ — WAITING FOR OTHER PLAYER TO SUBMIT"
              : isSetup
                ? `Use 1–${max}. Duplicate numbers turn red immediately. Enter or arrow keys move between boxes.`
                : isMyTurn
                  ? "YOUR TURN — click any number on your board to call it."
                  : "WAITING — the opponent's called numbers will turn green on your board."}
          </p>

          <div
            className={`bingo-board ${
              isSetup
                ? "editing"
                : "play-board"
            } ${
              isWaiting
                ? "waiting-board"
                : ""
            }`}
            style={{
              "--size": size,
            }}
          >
            {localBoard.map(
              (row, r) =>
                row.map(
                  (value, c) => {
                    const idx =
                      r * size + c;

                    const n =
                      Number(value);

                    const invalid =
                      isSetup &&
                      value !== "" &&
                      (!Number.isInteger(
                        n
                      ) ||
                        n < 1 ||
                        n > max);

                    const duplicate =
                      isSetup &&
                      value !== "" &&
                      counts[value] > 1;

                    const marked =
                      Boolean(
                        my?.board?.[
                          r
                        ]?.[
                          c
                        ]?.marked
                      );

                    if (!isSetup) {
                      return (
                        <button
                          key={idx}
                          data-cell={idx}
                          type="button"
                          className={`bingo-cell play-cell ${
                            marked
                              ? "marked"
                              : ""
                          }`}
                          onClick={() =>
                            call(n)
                          }
                          disabled={
                            !isMyTurn ||
                            !Number.isInteger(
                              n
                            ) ||
                            n < 1 ||
                            n > max ||
                            game.calledNumbers.includes(
                              n
                            )
                          }
                        >
                          <span>
                            {value}
                          </span>

                          {marked && (
                            <i className="cell-check">
                              ✓
                            </i>
                          )}
                        </button>
                      );
                    }

                    return (
                      <input
                        key={idx}
                        data-cell={idx}
                        className={`bingo-cell ${
                          invalid
                            ? "invalid-number"
                            : ""
                        } ${
                          duplicate
                            ? "duplicate-number"
                            : ""
                        }`}
                        value={
                          value ?? ""
                        }
                        inputMode="numeric"
                        maxLength={
                          String(max).length
                        }
                        onChange={(e) =>
                          change(
                            r,
                            c,
                            e.target.value
                          )
                        }
                        onKeyDown={(e) =>
                          handleKey(
                            e,
                            idx
                          )
                        }
                        disabled={isWaiting}
                        aria-label={`row ${
                          r + 1
                        } column ${
                          c + 1
                        }`}
                      />
                    );
                  }
                )
            )}
          </div>

          {isSetup && (
            <button
              className="primary wide ready-submit"
              disabled={isWaiting}
              onClick={submitBoard}
            >
              {isWaiting
                ? "✓ BOARD READY — WAITING FOR PLAYER"
                : "✓ READY — SUBMIT MY BOARD"}
            </button>
          )}
        </section>

        <aside className="side-panel">
          <h3>Players</h3>

          {game.players.map((p) => (
            <div
              className={`game-player ${
                String(p.userId) ===
                String(game.currentTurn)
                  ? "active"
                  : ""
              }`}
              key={p.userId}
            >
              <div className="avatar small">
                {p.username
                  .slice(0, 1)
                  .toUpperCase()}
              </div>

              <div className="gp-name">
                <b>
                  {p.username}
                  {String(
                    p.userId
                  ) ===
                  String(user._id)
                    ? " (You)"
                    : ""}
                </b>

                <span>
                  {p.status}
                </span>
              </div>

              <div className="gp-score">
                {p.completedLines}

                <small>
                  lines
                </small>
              </div>
            </div>
          ))}

          <div className="called">
            <h3>
              Called numbers
            </h3>

            <div className="called-list">
              {game.calledNumbers.length ? (
                game.calledNumbers.map(
                  (n) => (
                    <span key={n}>
                      {n}
                    </span>
                  )
                )
              ) : (
                <small className="muted">
                  No numbers called yet.
                </small>
              )}
            </div>
          </div>
        </aside>
      </main>

      <InviteOverlay
        invites={invites}
        respondInvite={respondInvite}
      />
    </div>
  );
}

export default function App() {
  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const token =
      localStorage.getItem(
        "bingo_token"
      );

    if (!token) {
      setLoading(false);
      return;
    }

    api("/auth/me")
      .then((d) =>
        setUser(d.user)
      )
      .catch(() =>
        localStorage.removeItem(
          "bingo_token"
        )
      )
      .finally(() =>
        setLoading(false)
      );
  }, []);

  const logout = () => {
    localStorage.removeItem(
      "bingo_token"
    );

    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        Loading BINGO…
      </div>
    );
  }

  return user ? (
    <Dashboard
      user={user}
      onLogout={logout}
    />
  ) : (
    <Auth onLogin={setUser} />
  );
}