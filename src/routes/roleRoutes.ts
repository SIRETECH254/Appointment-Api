import express from "express";
import {
  getAllRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getUsersByRole,
  getCustomers
} from "../controllers/roleController";
import { authenticateToken, authorizeRoles, requireAdmin } from "../middleware/auth";

const router = express.Router();

router.get("/", authenticateToken, authorizeRoles(["admin"]), getAllRoles);
router.get("/:roleId", authenticateToken, authorizeRoles(["admin"]), getRole);
router.post("/", authenticateToken, requireAdmin, createRole);
router.put("/:roleId", authenticateToken, requireAdmin, updateRole);
router.delete("/:roleId", authenticateToken, requireAdmin, deleteRole);
router.get("/:roleId/users", authenticateToken, authorizeRoles(["admin"]), getUsersByRole);
router.get("/customer/users", authenticateToken, authorizeRoles(["admin"]), getCustomers);

export default router;
