
/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notification management
 */

import express from "express";
import {
  sendNotification,
  getUserNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  getUnreadNotifications,
  getNotificationsByCategory,
  sendBulkNotification
} from "../controllers/notificationController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Send a notification to a user (Admin/Staff only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient
 *               - type
 *               - category
 *               - subject
 *               - message
 *             properties:
 *               recipient:
 *                 type: string
 *                 description: The ID of the user to send the notification to.
 *               type:
 *                 type: string
 *                 enum: [email, sms, in_app]
 *                 description: The type of notification to send.
 *               category:
 *                 type: string
 *                 enum: [general, appointment, payment]
 *                 description: The category of the notification.
 *               subject:
 *                 type: string
 *                 description: The subject of the notification.
 *               message:
 *                 type: string
 *                 description: The content of the notification message.
 *               metadata:
 *                 type: object
 *                 description: Optional metadata to include with the notification.
 *               actions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     label: { type: string }
 *                     type: { type: string, enum: [api, navigate, modal, confirm] }
 *                     endpoint: { type: string }
 *                     method: { type: string, enum: [GET, POST, PATCH, DELETE] }
 *                     payload: { type: object }
 *                     route: { type: string }
 *                     modal: { type: string }
 *                     variant: { type: string }
 *                     requiresConfirmation: { type: boolean }
 *                     confirmationMessage: { type: string }
 *                 description: Optional actions associated with the notification.
 *               context:
 *                 type: object
 *                 properties:
 *                   resourceId: { type: string }
 *                   resourceType: { type: string }
 *                   additionalData: { type: object }
 *                 description: Optional context data for the notification.
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiry date for the notification.
 *     responses:
 *       "201":
 *         description: Notification sent successfully.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid type/category).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin/Staff access required.
 *       "404":
 *         description: Recipient not found.
 *       "500":
 *         description: Server error.
 */
router.post("/", authenticateToken, authorizeRoles(["admin", "staff"]), sendNotification);
/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications (paginated)
 *     tags: [Notifications]
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
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, appointment, payment]
 *         description: Filter notifications by category.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [unread, read, pending, sent, failed]
 *         description: Filter notifications by read status or delivery status.
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [email, sms, in_app]
 *         description: Filter notifications by type.
 *     responses:
 *       "200":
 *         description: A paginated list of user notifications.
 *       "401":
 *         description: Unauthorized.
 *       "500":
 *         description: Server error.
 */
router.get("/", authenticateToken, getUserNotifications);
/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get count of unread notifications for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: The count of unread notifications.
 *       "401":
 *         description: Unauthorized.
 *       "500":
 *         description: Server error.
 */
router.get("/unread-count", authenticateToken, getUnreadCount);
/**
 * @swagger
 * /api/notifications/unread:
 *   get:
 *     summary: Get all unread notifications for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of unread notifications to return.
 *     responses:
 *       "200":
 *         description: A list of unread notifications.
 *       "401":
 *         description: Unauthorized.
 *       "500":
 *         description: Server error.
 */
router.get("/unread", authenticateToken, getUnreadNotifications);
/**
 * @swagger
 * /api/notifications/category/{category}:
 *   get:
 *     summary: Get notifications by category for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [general, appointment, payment]
 *         description: The category of notifications to retrieve.
 *     responses:
 *       "200":
 *         description: A list of notifications filtered by category.
 *       "400":
 *         description: Invalid notification category.
 *       "401":
 *         description: Unauthorized.
 *       "500":
 *         description: Server error.
 */
router.get("/category/:category", authenticateToken, getNotificationsByCategory);
/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   get:
 *     summary: Get a single notification by ID for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to retrieve.
 *     responses:
 *       "200":
 *         description: Details of the notification.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: User cannot access this notification (not the recipient).
 *       "404":
 *         description: Notification not found.
 *       "500":
 *         description: Server error.
 */
router.get("/:notificationId", authenticateToken, getNotification);
/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to mark as read.
 *     responses:
 *       "200":
 *         description: Notification marked as read successfully.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: User cannot mark this notification as read (not the recipient).
 *       "404":
 *         description: Notification not found.
 *       "500":
 *         description: Server error.
 */
router.patch("/:notificationId/read", authenticateToken, markAsRead);
/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Mark all unread notifications as read for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: All notifications marked as read successfully.
 *       "401":
 *         description: Unauthorized.
 *       "500":
 *         description: Server error.
 */
router.patch("/read-all", authenticateToken, markAllAsRead);
/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to delete.
 *     responses:
 *       "200":
 *         description: Notification deleted successfully.
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: User cannot delete this notification (not the recipient).
 *       "404":
 *         description: Notification not found.
 *       "500":
 *         description: Server error.
 */
router.delete("/:notificationId", authenticateToken, deleteNotification);
/**
 * @swagger
 * /api/notifications/bulk:
 *   post:
 *     summary: Send the same notification to multiple users (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *               - type
 *               - category
 *               - subject
 *               - message
 *             properties:
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: An array of user IDs to send the notification to.
 *               type:
 *                 type: string
 *                 enum: [email, sms, in_app]
 *                 description: The type of notification to send.
 *               category:
 *                 type: string
 *                 enum: [general, appointment, payment]
 *                 description: The category of the notification.
 *               subject:
 *                 type: string
 *                 description: The subject of the notification.
 *               message:
 *                 type: string
 *                 description: The content of the notification message.
 *     responses:
 *       "200":
 *         description: Bulk notification sent successfully with delivery summary.
 *       "400":
 *         description: Invalid input (e.g., missing fields, invalid type/category).
 *       "401":
 *         description: Unauthorized.
 *       "403":
 *         description: Admin access required.
 *       "500":
 *         description: Server error.
 */
router.post("/bulk", authenticateToken, authorizeRoles(["admin"]), sendBulkNotification);

export default router;
