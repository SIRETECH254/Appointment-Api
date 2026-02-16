
/**
 * @swagger
 * tags:
 *   name: Breaks
 *   description: Staff break time management
 */

import express from "express";
import {
  createBreak,
  getBreaks,
  getBreak,
  updateBreak,
  deleteBreak
} from "../controllers/breakController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

/**
 * @swagger
 * /api/breaks:
 *   get:
 *     summary: Get a list of staff breaks
 *     tags: [Breaks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *         description: Filter breaks by staff ID.
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter breaks for a specific date (YYYY-MM-DD).
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter breaks starting from this date/time.
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter breaks up to this date/time.
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
 *         description: A paginated list of breaks.
 *       "400":
 *         description: Invalid input (e.g., invalid ID or date format).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get("/", authenticateToken, requireAdmin, getBreaks);
/**
 * @swagger
 * /api/breaks/{breakId}:
 *   get:
 *     summary: Get a single break by ID
 *     tags: [Breaks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: breakId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the break to retrieve.
 *     responses:
 *       "200":
 *         description: Details of the break.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Break not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:breakId", authenticateToken, requireAdmin, getBreak);
/**
 * @swagger
 * /api/breaks:
 *   post:
 *     summary: Create a new break for a staff member
 *     tags: [Breaks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - staffId
 *               - startTime
 *               - endTime
 *             properties:
 *               staffId:
 *                 type: string
 *                 description: The ID of the staff member for whom to create the break.
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: The start time of the break.
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: The end time of the break.
 *               reason:
 *                 type: string
 *                 description: An optional reason for the break.
 *     responses:
 *       "201":
 *         description: Break created successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid times).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Staff not found.
 *       "500":
 *         description: Server error.
 */
router.post("/", authenticateToken, requireAdmin, createBreak);
/**
 * @swagger
 * /api/breaks/{breakId}:
 *   put:
 *     summary: Update an existing break
 *     tags: [Breaks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: breakId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the break to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               staffId:
 *                 type: string
 *                 description: The ID of the staff member (can be changed).
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: The new start time of the break.
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: The new end time of the break.
 *               reason:
 *                 type: string
 *                 description: The new reason for the break.
 *     responses:
 *       "200":
 *         description: Break updated successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid times).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Break or Staff not found.
 *       "500":
 *         description: Server error.
 */
router.put("/:breakId", authenticateToken, requireAdmin, updateBreak);
/**
 * @swagger
 * /api/breaks/{breakId}:
 *   delete:
 *     summary: Delete a break
 *     tags: [Breaks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: breakId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the break to delete.
 *     responses:
 *       "200":
 *         description: Break deleted successfully.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Break not found.
 *       "500":
 *         description: Server error.
 */
router.delete("/:breakId", authenticateToken, requireAdmin, deleteBreak);

export default router;
