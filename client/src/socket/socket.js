import { io } from "socket.io-client";
const URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
export function createSocket() {
  const token=localStorage.getItem("bingo_token");
  return io(URL,{auth:{token},transports:["websocket","polling"]});
}
