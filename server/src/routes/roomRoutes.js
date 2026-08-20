import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { createRoom, joinRoom } from "../controllers/roomController.js";
const router = Router();
router.post("/", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
export default router;
