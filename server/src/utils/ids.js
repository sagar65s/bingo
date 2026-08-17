import crypto from "node:crypto";

export const id = () => crypto.randomUUID();
export const roomCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
export const uid = () => `B${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
export const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");
