import express from "express";
import {
  getStoreConfiguration,
  updateStoreConfiguration
} from "../controllers/storeConfigurationController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

// Public read
router.get("/", getStoreConfiguration);
// Admin update
router.put("/", authenticateToken, requireAdmin, updateStoreConfiguration);

export default router;
