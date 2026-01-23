import express from "express";
import {
  createService,
  getServices,
  getService,
  updateService,
  deleteService,
  toggleServiceStatus,
  assignServicesToStaff
} from "../controllers/serviceController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

// Public list
router.get("/", getServices);
// Public detail
router.get("/:serviceId", getService);
// Admin create
router.post("/", authenticateToken, requireAdmin, createService);
// Admin update
router.put("/:serviceId", authenticateToken, requireAdmin, updateService);
// Admin delete
router.delete("/:serviceId", authenticateToken, requireAdmin, deleteService);
// Admin toggle status
router.patch("/:serviceId/toggle-status", authenticateToken, requireAdmin, toggleServiceStatus);
// Admin assign services to staff
router.post("/assign/:userId", authenticateToken, requireAdmin, assignServicesToStaff);

export default router;
