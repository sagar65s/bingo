import crypto from "node:crypto";

export const id = () => crypto.randomUUID();
export const roomCode = () => String(crypto.randomInt(100000, 1000000));
export const uid = () => `BNG${crypto.randomInt(100000, 1000000)}`;
export const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");
