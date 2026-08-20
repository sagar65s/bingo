import { store } from "../store/memoryStore.js";
export function listHistory(req,res) {
  const items = [...store.histories.values()].filter(h => h.finalRanking?.some?.(p => p.userId === req.auth.sub));
  res.json({items});
}
