
/**
 * @swagger
 * tags:
 *   name: Services
 *   description: Service catalog management
 */

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
/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Get a list of services
 *     tags: [Services]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search services by name or description.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter services by their active status.
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [sortOrder:asc, sortOrder:desc]
 *           default: sortOrder:asc
 *         description: Sort order for services.
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
 *         description: A paginated list of services.
 *       "500":
 *         description: Server error.
 */
router.get("/", getServices);
// Public detail
/**
 * @swagger
 * /api/services/{serviceId}:
 *   get:
 *     summary: Get a single service by ID
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the service to retrieve.
 *     responses:
 *       "200":
 *         description: Details of the service.
 *       "404":
 *         description: Service not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:serviceId", getService);
// Admin create
/**
 * @swagger
 * /api/services:
 *   post:
 *     summary: Create a new service (Admin only)
 *     tags: [Services]
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
 *               - duration
 *               - fullPrice
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the service.
 *               description:
 *                 type: string
 *                 description: A brief description of the service.
 *               duration:
 *                 type: number
 *                 description: The duration of the service in minutes.
 *               fullPrice:
 *                 type: number
 *                 description: The full price of the service.
 *               sortOrder:
 *                 type: number
 *                 description: The order in which the service should appear.
 *               isActive:
 *                 type: boolean
 *                 description: Whether the service is active.
 *     responses:
 *       "201":
 *         description: Service created successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid numbers, duplicate name).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.post("/", authenticateToken, requireAdmin, createService);
// Admin update
/**
 * @swagger
 * /api/services/{serviceId}:
 *   put:
 *     summary: Update an existing service (Admin only)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the service to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The new name of the service.
 *               description:
 *                 type: string
 *                 description: A new brief description of the service.
 *               duration:
 *                 type: number
 *                 description: The new duration of the service in minutes.
 *               fullPrice:
 *                 type: number
 *                 description: The new full price of the service.
 *               sortOrder:
 *                 type: number
 *                 description: The new order in which the service should appear.
 *               isActive:
 *                 type: boolean
 *                 description: Whether the service is active.
 *     responses:
 *       "200":
 *         description: Service updated successfully.
 *       "400":
 *         description: Invalid input (e.g., duplicate name, invalid numbers).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Service not found.
 *       "500":
 *         description: Server error.
 */
router.put("/:serviceId", authenticateToken, requireAdmin, updateService);
// Admin delete
/**
 * @swagger
 * /api/services/{serviceId}:
 *   delete:
 *     summary: Delete a service (Admin only)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the service to delete.
 *     responses:
 *       "200":
 *         description: Service deleted successfully.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Service not found.
 *       "500":
 *         description: Server error.
 */
router.delete("/:serviceId", authenticateToken, requireAdmin, deleteService);
// Admin toggle status
/**
 * @swagger
 * /api/services/{serviceId}/toggle-status:
 *   patch:
 *     summary: Activate or deactivate a service (Admin only)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the service to toggle status.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: Explicitly set the active status. If omitted, the status is toggled.
 *     responses:
 *       "200":
 *         description: Service status updated successfully.
 *       "400":
 *         description: Invalid input (e.g., isActive is not a boolean).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Service not found.
 *       "500":
 *         description: Server error.
 */
router.patch("/:serviceId/toggle-status", authenticateToken, requireAdmin, toggleServiceStatus);
// Admin assign services to staff
/**
 * @swagger
 * /api/services/assign/{userId}:
 *   post:
 *     summary: Assign multiple services to a staff user (Admin only)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the staff user to assign services to.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceIds
 *             properties:
 *               serviceIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: An array of service IDs to assign to the staff member.
 *     responses:
 *       "200":
 *         description: Services assigned to staff successfully.
 *       "400":
 *         description: Invalid input (e.g., empty serviceIds array, user is not staff).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: User or one or more services not found.
 *       "500":
 *         description: Server error.
 */
router.post("/assign/:userId", authenticateToken, requireAdmin, assignServicesToStaff);

export default router;
