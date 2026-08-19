import crypto from "node:crypto";

export const id = () => crypto.randomUUID();
export const roomCode = () => String(crypto.randomInt(100000, 1000000));
export const uid = () => `B${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
export const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");
