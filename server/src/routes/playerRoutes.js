import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { onlinePlayers } from "../controllers/playerController.js";
const router=Router();router.get("/online",authMiddleware,onlinePlayers);export default router;
