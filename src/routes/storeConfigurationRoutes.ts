
/**
 * @swagger
 * tags:
 *   name: Store Configuration
 *   description: Global business rule configuration
 */

import express from "express";
import {
  getStoreConfiguration,
  updateStoreConfiguration
} from "../controllers/storeConfigurationController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

// Public read
/**
 * @swagger
 * /api/store-configuration:
 *   get:
 *     summary: Get the store's global configuration (Public)
 *     tags: [Store Configuration]
 *     responses:
 *       "200":
 *         description: The current store configuration.
 *       "500":
 *         description: Server error.
 */
router.get("/", getStoreConfiguration);
// Admin update
/**
 * @swagger
 * /api/store-configuration:
 *   put:
 *     summary: Update the store's global configuration (Admin only)
 *     tags: [Store Configuration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appointmentFeeType:
 *                 type: string
 *                 enum: [FIXED, PERCENTAGE]
 *                 description: Type of appointment fee.
 *               appointmentFeeValue:
 *                 type: number
 *                 description: Value of the appointment fee.
 *               currency:
 *                 type: string
 *                 enum: [KES]
 *                 description: Currency used for transactions.
 *               minBookingNotice:
 *                 type: number
 *                 description: Minimum notice in minutes required for booking.
 *               lateGracePeriod:
 *                 type: number
 *                 description: Grace period in minutes for late arrivals.
 *               allowWalkIns:
 *                 type: boolean
 *                 description: Whether walk-in appointments are allowed.
 *               notificationSettings:
 *                 type: object
 *                 properties:
 *                   sendSMS: { type: boolean }
 *                   sendEmail: { type: boolean }
 *                   sendPush: { type: boolean }
 *                   reminderTimes:
 *                     type: array
 *                     items: { type: number }
 *                     description: Array of reminder times in minutes before an appointment.
 *                 description: Configuration for various notification channels.
 *               businessHoursTimezone:
 *                 type: string
 *                 enum: [Africa/Nairobi]
 *                 description: Timezone for business hours.
 *     responses:
 *       "200":
 *         description: Store configuration updated successfully.
 *       "400":
 *         description: Invalid input (e.g., malformed notification settings, invalid reminder times).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.put("/", authenticateToken, requireAdmin, updateStoreConfiguration);

export default router;
