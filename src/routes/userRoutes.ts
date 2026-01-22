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

router.get("/profile", authenticateToken, getUserProfile);
router.put("/profile", authenticateToken, updateUserProfile);
router.put("/change-password", authenticateToken, changePassword);
router.get("/notifications", authenticateToken, getNotificationPreferences);
router.put("/notifications", authenticateToken, updateNotificationPreferences);
router.post("/admin-create", authenticateToken, authorizeRoles(["admin"]), adminCreateCustomer);
router.get("/customers", authenticateToken, authorizeRoles(["admin"]), getCustomers);
router.get("/", authenticateToken, authorizeRoles(["admin"]), getAllUsers);
router.get("/:userId", authenticateToken, authorizeRoles(["admin"]), getUserById);
router.put("/:userId", authenticateToken, authorizeRoles(["admin"]), updateUser);
router.put("/:userId/status", authenticateToken, authorizeRoles(["admin"]), updateUserStatus);
router.put("/:userId/admin", authenticateToken, requireAdmin, setUserAdmin);
router.get("/:userId/roles", authenticateToken, authorizeRoles(["admin"]), getUserRoles);
router.delete("/:userId", authenticateToken, requireAdmin, deleteUser);
router.post("/:userId/roles", authenticateToken, requireAdmin, assignRole);
router.delete("/:userId/roles/:roleId", authenticateToken, requireAdmin, removeRole);

export default router;
