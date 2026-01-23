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

// List roles
router.get("/", authenticateToken, authorizeRoles(["admin"]), getAllRoles);
// Get role by ID
router.get("/:roleId", authenticateToken, authorizeRoles(["admin"]), getRole);
// Create a new role
router.post("/", authenticateToken, requireAdmin, createRole);
// Update role details
router.put("/:roleId", authenticateToken, requireAdmin, updateRole);
// Delete a role
router.delete("/:roleId", authenticateToken, requireAdmin, deleteRole);
// List users by role
router.get("/:roleId/users", authenticateToken, authorizeRoles(["admin"]), getUsersByRole);
// List customers
router.get("/customer/users", authenticateToken, authorizeRoles(["admin"]), getCustomers);

export default router;
