
/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and history
 */

import express from "express";
import {
  initiatePayment,
  servicePayment,
  mpesaWebhook,
  paystackWebhook,
  getPayments,
  getPayment,
  checkPaymentStatus
} from "../controllers/paymentController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

/**
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Initiate a service-only payment (no appointment required)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - services
 *               - method
 *             properties:
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of service IDs to be paid for.
 *               method:
 *                 type: string
 *                 enum: [MPESA, CARD, CASH]
 *                 description: Payment method.
 *               phone:
 *                 type: string
 *                 description: Phone number for MPESA payments.
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email for CARD payments.
 *     responses:
 *       "200":
 *         description: Payment initiated successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid method).
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: Service not found.
 *       "500":
 *         description: Server error.
 */
router.post("/initiate", authenticateToken, initiatePayment);
/**
 * @swagger
 * /api/payments/service-payment:
 *   post:
 *     summary: Pay the remaining amount for an appointment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentId
 *               - method
 *             properties:
 *               appointmentId:
 *                 type: string
 *                 description: The ID of the appointment to pay for.
 *               method:
 *                 type: string
 *                 enum: [MPESA, CARD, CASH]
 *                 description: Payment method.
 *               phone:
 *                 type: string
 *                 description: Phone number for MPESA payments.
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email for CARD payments.
 *     responses:
 *       "200":
 *         description: Service payment initiated successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, no remaining amount).
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: Appointment not found.
 *       "500":
 *         description: Server error.
 */
router.post("/service-payment", authenticateToken, servicePayment);
/**
 * @swagger
 * /api/payments/webhooks/mpesa:
 *   post:
 *     summary: M-Pesa (Daraja) webhook for payment callbacks
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: M-Pesa STK Push callback payload.
 *     responses:
 *       "200":
 *         description: Webhook received and processed.
 *       "500":
 *         description: Server error during webhook processing.
 */
router.post("/webhooks/mpesa", mpesaWebhook);
/**
 * @swagger
 * /api/payments/webhooks/paystack:
 *   post:
 *     summary: Paystack webhook for payment callbacks
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Paystack webhook payload.
 *     responses:
 *       "200":
 *         description: Webhook received and processed.
 *       "500":
 *         description: Server error during webhook processing.
 */
router.post("/webhooks/paystack", paystackWebhook);
/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get a list of payments (Admin/Staff only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, SUCCESS, FAILED]
 *         description: Filter payments by their status.
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [MPESA, CARD, CASH]
 *         description: Filter payments by payment method.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter payments created on or after this date.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter payments created on or before this date.
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
 *         description: A paginated list of payments.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin/Staff access required.
 *       "500":
 *         description: Server error.
 */
router.get("/", authenticateToken, authorizeRoles(["admin", "staff"]), getPayments);
/**
 * @swagger
 * /api/payments/status/{checkoutRequestId}:
 *   get:
 *     summary: Check M-Pesa STK push payment status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: checkoutRequestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The CheckoutRequestID from the M-Pesa STK push initiation.
 *     responses:
 *       "200":
 *         description: Payment details and the current status of the STK push.
 *       "400":
 *         description: Missing checkoutRequestId.
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: Payment not found for the given checkoutRequestId.
 *       "500":
 *         description: Server error while querying M-Pesa status.
 */
router.get("/status/:checkoutRequestId", authenticateToken, checkPaymentStatus);
/**
 * @swagger
 * /api/payments/{paymentId}:
 *   get:
 *     summary: Get a single payment by ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payment to retrieve.
 *     responses:
 *       "200":
 *         description: Details of the payment.
 *       "401":
 *         description: Unauthorized.
 *       "404":
 *         description: Payment not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:paymentId", authenticateToken, getPayment);

export default router;
