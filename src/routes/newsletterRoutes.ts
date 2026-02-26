/**
 * @swagger
 * tags:
 *   name: Newsletter
 *   description: Newsletter subscription management
 */

import express from "express";
import {
  subscribeNewsletter,
  unsubscribeNewsletter,
  getSubscribers,
  getSubscriber,
  updateSubscriberStatus,
  deleteSubscriber,
  sendNewsletter,
  getSubscriptionStats
} from "../controllers/newsletterController";
import { authenticateToken, requireAdmin, optionalAuth } from "../middleware/auth";

const router = express.Router();

/**
 * @swagger
 * /api/newsletter/subscribe:
 *   post:
 *     summary: Subscribe to newsletter (publicly accessible)
 *     tags: [Newsletter]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address for subscription.
 *     responses:
 *       "201":
 *         description: Successfully subscribed to newsletter.
 *       "400":
 *         description: Invalid input (e.g., missing email, invalid email format, already subscribed).
 *       "500":
 *         description: Server error.
 */
router.post("/subscribe", optionalAuth, subscribeNewsletter);

/**
 * @swagger
 * /api/newsletter/unsubscribe:
 *   get:
 *     summary: Unsubscribe from newsletter (publicly accessible)
 *     tags: [Newsletter]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Unsubscribe token.
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: Email address to unsubscribe.
 *     responses:
 *       "200":
 *         description: Successfully unsubscribed from newsletter.
 *       "400":
 *         description: Token or email is required.
 *       "404":
 *         description: Subscriber not found.
 *       "500":
 *         description: Server error.
 */
router.get("/unsubscribe", unsubscribeNewsletter);

/**
 * @swagger
 * /api/newsletter:
 *   get:
 *     summary: Get a list of newsletter subscribers (Admin only)
 *     tags: [Newsletter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUBSCRIBED, UNSUBSCRIBED, BOUNCED]
 *         description: Filter subscribers by their status.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search subscribers by email.
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [subscribedAt:asc, subscribedAt:desc, email:asc, email:desc]
 *           default: subscribedAt:desc
 *         description: Sort order for subscribers.
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
 *         description: A paginated list of newsletter subscribers.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get("/", authenticateToken, requireAdmin, getSubscribers);

/**
 * @swagger
 * /api/newsletter/stats:
 *   get:
 *     summary: Get newsletter subscription statistics (Admin only)
 *     tags: [Newsletter]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Subscription statistics including total, by status, and recent subscriptions.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.get("/stats", authenticateToken, requireAdmin, getSubscriptionStats);

/**
 * @swagger
 * /api/newsletter/{subscriberId}:
 *   get:
 *     summary: Get a single newsletter subscriber by ID (Admin only)
 *     tags: [Newsletter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriberId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the subscriber to retrieve.
 *     responses:
 *       "200":
 *         description: Details of the newsletter subscriber.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Subscriber not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:subscriberId", authenticateToken, requireAdmin, getSubscriber);

/**
 * @swagger
 * /api/newsletter/{subscriberId}/status:
 *   patch:
 *     summary: Update the status of a newsletter subscriber (Admin only)
 *     tags: [Newsletter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriberId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the subscriber to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [SUBSCRIBED, UNSUBSCRIBED, BOUNCED]
 *                 description: The new status for the subscriber.
 *     responses:
 *       "200":
 *         description: Subscriber status updated successfully.
 *       "400":
 *         description: Invalid status provided.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Subscriber not found.
 *       "500":
 *         description: Server error.
 */
router.patch("/:subscriberId/status", authenticateToken, requireAdmin, updateSubscriberStatus);

/**
 * @swagger
 * /api/newsletter/{subscriberId}:
 *   delete:
 *     summary: Delete a newsletter subscriber (Admin only)
 *     tags: [Newsletter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriberId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the subscriber to delete.
 *     responses:
 *       "200":
 *         description: Subscriber deleted successfully.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "404":
 *         description: Subscriber not found.
 *       "500":
 *         description: Server error.
 */
router.delete("/:subscriberId", authenticateToken, requireAdmin, deleteSubscriber);

/**
 * @swagger
 * /api/newsletter/send:
 *   post:
 *     summary: Send newsletter to subscribers (Admin only)
 *     tags: [Newsletter]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *                 description: Subject of the newsletter email.
 *               message:
 *                 type: string
 *                 description: Content of the newsletter email.
 *               status:
 *                 type: string
 *                 enum: [SUBSCRIBED, UNSUBSCRIBED, BOUNCED]
 *                 default: SUBSCRIBED
 *                 description: Status filter for subscribers to send to.
 *     responses:
 *       "200":
 *         description: Newsletter sent successfully.
 *       "400":
 *         description: Invalid input (e.g., missing subject/message, no subscribers found).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.post("/send", authenticateToken, requireAdmin, sendNewsletter);

export default router;
