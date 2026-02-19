
/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment scheduling and management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Appointment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The unique identifier for the appointment.
 *         customerId:
 *           type: string
 *           description: The ID of the customer who booked the appointment.
 *         staffId:
 *           type: string
 *           description: The ID of the staff member assigned to the appointment.
 *         services:
 *           type: array
 *           items:
 *             type: string
 *           description: A list of service IDs included in the appointment.
 *         startTime:
 *           type: string
 *           format: date-time
 *           description: The scheduled start time of the appointment.
 *         endTime:
 *           type: string
 *           format: date-time
 *           description: The scheduled end time of the appointment.
 *         status:
 *           type: string
 *           enum: [PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW]
 *           description: The current status of the appointment.
 *         bookingFeeAmount:
 *           type: number
 *           description: The calculated booking fee for the appointment.
 *         remainingAmount:
 *           type: number
 *           description: The remaining amount to be paid for the appointment.
 *         checkedInAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the customer checked in.
 *         actualEndTime:
 *           type: string
 *           format: date-time
 *           description: The actual end time of the appointment.
 */
import express from "express";
import {
  createAppointment,
  confirmAppointment,
  rescheduleAppointment,
  cancelAppointment,
  checkIn,
  completeAppointment,
  markNoShow,
  getAppointments,
  getMyAppointments,
  getAppointmentById,
  deleteAppointment
} from "../controllers/appointmentController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

router.post("/", authenticateToken, authorizeRoles(["customer", "admin"]), createAppointment);

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
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
 *               - services
 *               - startTime
 *               - endTime
 *             properties:
 *               staffId:
 *                 type: string
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       "201":
 *         description: Appointment created successfully.
 *       "400":
 *         description: Bad request due to invalid input.
 */

/**
 * @swagger
 * /api/appointments/{appointmentId}/confirm:
 *   post:
 *     summary: Confirm an appointment and initiate payment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - method
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [MPESA, CARD]
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Payment initiated successfully.
 *       "400":
 *         description: Bad request or appointment cannot be confirmed.
 */
router.post("/:appointmentId/confirm", authenticateToken, authorizeRoles(["customer", "admin"]), confirmAppointment);
/**
 * @swagger
 * /api/appointments/{appointmentId}/reschedule:
 *   patch:
 *     summary: Reschedule an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startTime
 *               - endTime
 *             properties:
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       "200":
 *         description: Appointment rescheduled successfully.
 *       "400":
 *         description: Bad request or appointment cannot be rescheduled.
 */
router.patch("/:appointmentId/reschedule", authenticateToken, authorizeRoles(["admin", "staff", "customer"]), rescheduleAppointment);
/**
 * @swagger
 * /api/appointments/{appointmentId}/cancel:
 *   patch:
 *     summary: Cancel an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Appointment cancelled successfully.
 *       "400":
 *         description: Bad request or appointment cannot be cancelled.
 */
router.patch("/:appointmentId/cancel", authenticateToken, authorizeRoles(["admin", "staff", "customer"]), cancelAppointment);
/**
 * @swagger
 * /api/appointments/{appointmentId}/check-in:
 *   patch:
 *     summary: Check in a customer for an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Customer checked in successfully.
 *       "400":
 *         description: Bad request or appointment cannot be checked in.
 */
router.patch("/:appointmentId/check-in", authenticateToken, authorizeRoles(["staff", "admin"]), checkIn);
/**
 * @swagger
 * /api/appointments/{appointmentId}/complete:
 *   patch:
 *     summary: Mark an appointment as completed
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Appointment completed successfully.
 */
router.patch("/:appointmentId/complete", authenticateToken, authorizeRoles(["staff", "admin"]), completeAppointment);
/**
 * @swagger
 * /api/appointments/{appointmentId}/no-show:
 *   patch:
 *     summary: Mark an appointment as a no-show
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Appointment marked as no-show successfully.
 */
router.patch("/:appointmentId/no-show", authenticateToken, authorizeRoles(["staff", "admin"]), markNoShow);
/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Get a list of appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       "200":
 *         description: A list of appointments.
 */
router.get("/", authenticateToken, authorizeRoles(["admin", "staff"]), getAppointments);
/**
 * @swagger
 * /api/appointments/my:
 *   get:
 *     summary: Get appointments for the current customer
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       "200":
 *         description: A list of the customer''s appointments.
 */
router.get("/my", authenticateToken, getMyAppointments);
/**
 * @swagger
 * /api/appointments/{appointmentId}:
 *   get:
 *     summary: Get a single appointment by ID
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: The appointment details.
 *       "404":
 *         description: Appointment not found.
 */
router.get("/:appointmentId", authenticateToken, getAppointmentById);
/**
 * @swagger
 * /api/appointments/{appointmentId}:
 *   delete:
 *     summary: Delete an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Appointment deleted successfully.
 *       "404":
 *         description: Appointment not found.
 */
router.delete("/:appointmentId", authenticateToken, authorizeRoles(["admin", "staff"]), deleteAppointment);

export default router;
