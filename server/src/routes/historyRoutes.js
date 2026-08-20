import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { listHistory } from "../controllers/historyController.js";
const router = Router();
router.get("/", authMiddleware, listHistory);
export default router;
