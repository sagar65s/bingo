import { Router } from 'express';import { authMiddleware } from '../middleware/authMiddleware.js';import { onlinePlayers,leaderboard } from '../controllers/playerController.js';
const router=Router();router.get('/online',authMiddleware,onlinePlayers);router.get('/leaderboard',authMiddleware,leaderboard);export default router;
