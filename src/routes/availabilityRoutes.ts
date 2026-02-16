
/**
 * @swagger
 * tags:
 *   name: Availability
 *   description: Staff availability and slot calculation
 */

import express from "express";
import { getAvailableSlots, getDayAvailability } from "../controllers/availabilityController";

const router = express.Router();

// Public availability endpoints
/**
 * @swagger
 * /api/availability/slots:
 *   get:
 *     summary: Get available slots for staff, service, and date
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the staff member.
 *       - in: query
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: The ID(s) of the service(s). Can be repeated for multiple services.
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: The date for which to check availability (YYYY-MM-DD).
 *     responses:
 *       "200":
 *         description: An array of available time slots.
 *       "400":
 *         description: Invalid input (e.g., missing parameters, invalid ID, invalid date format).
 *       "404":
 *         description: Staff or service not found.
 *       "500":
 *         description: Server error.
 */
router.get("/slots", getAvailableSlots);
/**
 * @swagger
 * /api/availability/day:
 *   get:
 *     summary: Get day-level availability summary
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the staff member.
 *       - in: query
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: The ID(s) of the service(s). Can be repeated for multiple services.
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: The date for which to check availability (YYYY-MM-DD).
 *     responses:
 *       "200":
 *         description: Day availability summary with total and available slots.
 *       "400":
 *         description: Invalid input (e.g., missing parameters, invalid ID, invalid date format).
 *       "404":
 *         description: Staff or service not found.
 *       "500":
 *         description: Server error.
 */
router.get("/day", getDayAvailability);

export default router;
