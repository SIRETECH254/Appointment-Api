import express from "express";
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  getNotificationPreferences,
  updateNotificationPreferences,
  getAllUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  setUserAdmin,
  getUserRoles,
  deleteUser,
  adminCreateCustomer,
  assignRole,
  removeRole,
  getCustomers
} from "../controllers/userController";
import { authenticateToken, authorizeRoles, requireAdmin } from "../middleware/auth";

const router = express.Router();

// Get current user profile
router.get("/profile", authenticateToken, getUserProfile);
// Update current user profile
router.put("/profile", authenticateToken, updateUserProfile);
// Change current user password
router.put("/change-password", authenticateToken, changePassword);
// Get notification preferences
router.get("/notifications", authenticateToken, getNotificationPreferences);
// Update notification preferences
router.put("/notifications", authenticateToken, updateNotificationPreferences);
// Admin create customer
router.post("/admin-create", authenticateToken, authorizeRoles(["admin"]), adminCreateCustomer);
// List customers
router.get("/customers", authenticateToken, authorizeRoles(["admin"]), getCustomers);
// List all users
router.get("/", authenticateToken, authorizeRoles(["admin"]), getAllUsers);
// Get user by ID
router.get("/:userId", authenticateToken, authorizeRoles(["admin"]), getUserById);
// Update user by ID
router.put("/:userId", authenticateToken, authorizeRoles(["admin"]), updateUser);
// Update user status
router.put("/:userId/status", authenticateToken, authorizeRoles(["admin"]), updateUserStatus);
// Set single admin role (legacy)
router.put("/:userId/admin", authenticateToken, requireAdmin, setUserAdmin);
// Get user roles
router.get("/:userId/roles", authenticateToken, authorizeRoles(["admin"]), getUserRoles);
// Delete user
router.delete("/:userId", authenticateToken, requireAdmin, deleteUser);
// Assign role to user
router.post("/:userId/roles", authenticateToken, requireAdmin, assignRole);
// Remove role from user
router.delete("/:userId/roles/:roleId", authenticateToken, requireAdmin, removeRole);

export default router;
