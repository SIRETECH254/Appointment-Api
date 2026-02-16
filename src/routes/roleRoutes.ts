
/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: User role and permission management
 */

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
/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get a list of all roles (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter roles by their active status.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search roles by name, display name, or description.
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
 *     responses:
 *       "200":
 *         description: A paginated list of roles.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get("/", authenticateToken, authorizeRoles(["admin"]), getAllRoles);
// Get role by ID
/**
 * @swagger
 * /api/roles/{roleId}:
 *   get:
 *     summary: Get a single role by ID (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to retrieve.
 *     responses:
 *       "200":
 *         description: Details of the role.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Role not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:roleId", authenticateToken, authorizeRoles(["admin"]), getRole);
// Create a new role
/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new custom role (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *             properties:
 *               name:
 *                 type: string
 *                 description: The internal name of the role (e.g., 'support_agent').
 *               displayName:
 *                 type: string
 *                 description: The user-friendly display name of the role (e.g., 'Support Agent').
 *               description:
 *                 type: string
 *                 description: A brief description of the role.
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: A list of permissions granted to this role.
 *               isActive:
 *                 type: boolean
 *                 description: Whether the role is active.
 *     responses:
 *       "201":
 *         description: Role created successfully.
 *       "400":
 *         description: Invalid input (e.g., missing name/displayName, duplicate name).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.post("/", authenticateToken, requireAdmin, createRole);
// Update role details
/**
 * @swagger
 * /api/roles/{roleId}:
 *   put:
 *     summary: Update an existing role (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 description: The new display name of the role.
 *               description:
 *                 type: string
 *                 description: The new description of the role.
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: The new list of permissions for this role.
 *               isActive:
 *                 type: boolean
 *                 description: The new active status of the role.
 *     responses:
 *       "200":
 *         description: Role updated successfully.
 *       "400":
 *         description: Cannot change system role name or other invalid input.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Role not found.
 *       "500":
 *         description: Server error.
 */
router.put("/:roleId", authenticateToken, requireAdmin, updateRole);
// Delete a role
/**
 * @swagger
 * /api/roles/{roleId}:
 *   delete:
 *     summary: Delete a role (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to delete.
 *     responses:
 *       "200":
 *         description: Role deleted successfully.
 *       "400":
 *         description: Cannot delete system roles or roles with assigned users.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Role not found.
 *       "500":
 *         description: Server error.
 */
router.delete("/:roleId", authenticateToken, requireAdmin, deleteRole);
// List users by role
/**
 * @swagger
 * /api/roles/{roleId}/users:
 *   get:
 *     summary: Get a list of users assigned to a specific role (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to retrieve users for.
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter users by their active status.
 *     responses:
 *       "200":
 *         description: A paginated list of users for the specified role.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Role not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:roleId/users", authenticateToken, authorizeRoles(["admin"]), getUsersByRole);
// List customers
/**
 * @swagger
 * /api/roles/customer/users:
 *   get:
 *     summary: Get a list of users with the 'customer' role (Admin only)
 *     tags: [Roles]
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
 *         description: A paginated list of customers.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Customer role not found (if seed script not run).
 *       "500":
 *         description: Server error.
 */
router.get("/customer/users", authenticateToken, authorizeRoles(["admin"]), getCustomers);

export default router;
