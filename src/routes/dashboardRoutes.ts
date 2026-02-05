import express from "express";
import { getDashboardStats } from "../controllers/dashboardController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

// Admin only - get dashboard statistics
router.get("/stats", authenticateToken, requireAdmin, getDashboardStats);

export default router;
