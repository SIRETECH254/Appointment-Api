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

router.post("/", authenticateToken, authorizeRoles(["admin", "staff"]), sendNotification);
router.get("/", authenticateToken, getUserNotifications);
router.get("/unread-count", authenticateToken, getUnreadCount);
router.get("/unread", authenticateToken, getUnreadNotifications);
router.get("/category/:category", authenticateToken, getNotificationsByCategory);
router.get("/:notificationId", authenticateToken, getNotification);
router.patch("/:notificationId/read", authenticateToken, markAsRead);
router.patch("/read-all", authenticateToken, markAllAsRead);
router.delete("/:notificationId", authenticateToken, deleteNotification);
router.post("/bulk", authenticateToken, authorizeRoles(["admin"]), sendBulkNotification);

export default router;
