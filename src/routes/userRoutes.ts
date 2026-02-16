
/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User account and profile management
 */

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
import { uploadUserAvatar } from "../config/cloudinary";

const router = express.Router();

// Get current user profile
/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Current user profile data.
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.get("/profile", authenticateToken, getUserProfile);
// Update current user profile
/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: URL of the user's avatar image. Send null or empty string to remove.
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: User's avatar image file.
 *     responses:
 *       "200":
 *         description: Profile updated successfully.
 *       "400":
 *         description: Invalid input (e.g., invalid phone, duplicate phone).
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.put("/profile", authenticateToken, uploadUserAvatar.single("avatar"), updateUserProfile);
// Change current user password
/**
 * @swagger
 * /api/users/change-password:
 *   put:
 *     summary: Change current user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       "200":
 *         description: Password changed successfully.
 *       "400":
 *         description: Invalid input (e.g., current password incorrect, new password too short).
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.put("/change-password", authenticateToken, changePassword);
// Get notification preferences
/**
 * @swagger
 * /api/users/notifications:
 *   get:
 *     summary: Get notification preferences for the current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Current user's notification preferences.
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.get("/notifications", authenticateToken, getNotificationPreferences);
// Update notification preferences
/**
 * @swagger
 * /api/users/notifications:
 *   put:
 *     summary: Update notification preferences for the current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: boolean
 *                 description: Enable or disable email notifications.
 *               sms:
 *                 type: boolean
 *                 description: Enable or disable SMS notifications.
 *               inApp:
 *                 type: boolean
 *                 description: Enable or disable in-app notifications.
 *     responses:
 *       "200":
 *         description: Notification preferences updated successfully.
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.put("/notifications", authenticateToken, updateNotificationPreferences);
// Admin create customer
/**
 * @swagger
 * /api/users/admin-create:
 *   post:
 *     summary: Admin create customer (Admin/Staff only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               roleName:
 *                 type: string
 *                 description: Optional role name to assign (defaults to 'customer').
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *     responses:
 *       "201":
 *         description: Customer created successfully.
 *       "400":
 *         description: Invalid input or user with email/phone already exists.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin/Staff access required.
 *       "404":
 *         description: Role not found.
 *       "500":
 *         description: Server error.
 */
router.post("/admin-create", authenticateToken, authorizeRoles(["admin"]), adminCreateCustomer);
// List customers
/**
 * @swagger
 * /api/users/customers:
 *   get:
 *     summary: Get a paginated list of customers (Admin/Staff only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search customers by first name, last name, or email.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, verified, unverified]
 *         description: Filter customers by their active or verification status.
 *     responses:
 *       "200":
 *         description: A paginated list of customer users.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin/Staff access required.
 *       "404":
 *         description: Customer role not found.
 *       "500":
 *         description: Server error.
 */
router.get("/customers", authenticateToken, authorizeRoles(["admin"]), getCustomers);
// List all users
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get a paginated list of all users (Admin/Staff only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search users by first name, last name, or email.
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [customer, admin, staff]
 *         description: Filter users by a specific role.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, verified, unverified]
 *         description: Filter users by their active or verification status.
 *     responses:
 *       "200":
 *         description: A paginated list of all users.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin/Staff access required.
 *       "404":
 *         description: Role not found.
 *       "500":
 *         description: Server error.
 */
router.get("/", authenticateToken, authorizeRoles(["admin"]), getAllUsers);
// Get user by ID
/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get a single user's profile by ID (Admin/Staff only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to retrieve.
 *     responses:
 *       "200":
 *         description: Details of the user's profile.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin/Staff access required.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:userId", authenticateToken, authorizeRoles(["admin"]), getUserById);
// Update user by ID
/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     summary: Update a user's profile information (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to update.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: URL of the user's avatar image. Send null or empty string to remove.
 *               workingHours:
 *                 type: object
 *                 description: Staff working hours configuration.
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: User's avatar image file.
 *               workingHours:
 *                 type: string
 *                 description: JSON string of staff working hours configuration.
 *     responses:
 *       "200":
 *         description: User profile updated successfully.
 *       "400":
 *         description: Invalid input (e.g., invalid phone/email, duplicate email/phone, invalid workingHours format).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.put("/:userId", authenticateToken, authorizeRoles(["admin"]), uploadUserAvatar.single("avatar"), updateUser);
// Update user status
/**
 * @swagger
 * /api/users/{userId}/status:
 *   put:
 *     summary: Update a user's active status (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user whose status to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: The new active status for the user (true for active, false for inactive).
 *     responses:
 *       "200":
 *         description: User status updated successfully.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.put("/:userId/status", authenticateToken, authorizeRoles(["admin"]), updateUserStatus);
// Set single admin role (legacy)
/**
 * @swagger
 * /api/users/{userId}/admin:
 *   put:
 *     summary: Set a user's role (legacy endpoint, Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user whose role to set.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, staff, customer]
 *                 description: The role to assign to the user.
 *     responses:
 *       "200":
 *         description: User role updated successfully.
 *       "400":
 *         description: Invalid role provided.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: User or role not found.
 *       "500":
 *         description: Server error.
 */
router.put("/:userId/admin", authenticateToken, requireAdmin, setUserAdmin);
// Get user roles
/**
 * @swagger
 * /api/users/{userId}/roles:
 *   get:
 *     summary: Get roles assigned to a user (Admin/Staff only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user whose roles to retrieve.
 *     responses:
 *       "200":
 *         description: A list of roles assigned to the user.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin/Staff access required.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:userId/roles", authenticateToken, authorizeRoles(["admin"]), getUserRoles);
// Delete user
/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete a user account (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user account to delete.
 *     responses:
 *       "200":
 *         description: User deleted successfully.
 *       "400":
 *         description: Cannot delete your own account.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: User not found.
 *       "500":
 *         description: Server error.
 */
router.delete("/:userId", authenticateToken, requireAdmin, deleteUser);
// Assign role to user
/**
 * @swagger
 * /api/users/{userId}/roles:
 *   post:
 *     summary: Assign a role to a user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to assign a role to.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleName
 *             properties:
 *               roleName:
 *                 type: string
 *                 description: The name of the role to assign (e.g., 'staff', 'admin').
 *     responses:
 *       "200":
 *         description: Role assigned successfully.
 *       "400":
 *         description: Role name is required or role already assigned.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: User or role not found.
 *       "500":
 *         description: Server error.
 */
router.post("/:userId/roles", authenticateToken, requireAdmin, assignRole);
// Remove role from user
/**
 * @swagger
 * /api/users/{userId}/roles/{roleId}:
 *   delete:
 *     summary: Remove a role from a user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to remove the role from.
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to remove.
 *     responses:
 *       "200":
 *         description: Role removed successfully.
 *       "400":
 *         description: User must have at least one role.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: User or role not found.
 *       "500":
 *         description: Server error.
 */
router.delete("/:userId/roles/:roleId", authenticateToken, requireAdmin, removeRole);

export default router;
