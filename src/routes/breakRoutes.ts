import express from "express";
import {
  createBreak,
  getBreaks,
  getBreak,
  updateBreak,
  deleteBreak
} from "../controllers/breakController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

router.get("/", authenticateToken, requireAdmin, getBreaks);
router.get("/:breakId", authenticateToken, requireAdmin, getBreak);
router.post("/", authenticateToken, requireAdmin, createBreak);
router.put("/:breakId", authenticateToken, requireAdmin, updateBreak);
router.delete("/:breakId", authenticateToken, requireAdmin, deleteBreak);

export default router;
