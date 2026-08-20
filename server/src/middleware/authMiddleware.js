import { verifyToken } from "../utils/auth.js";

export function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({message:"Authentication required"});
    req.auth = verifyToken(token);
    next();
  } catch {
    res.status(401).json({message:"Invalid or expired token"});
  }
}
