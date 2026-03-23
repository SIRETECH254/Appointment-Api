import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Notification from "../models/Notification";
import User from "../models/User";
import { sendGenericEmail } from "../services/external/emailService";
import { sendGenericSMS } from "../services/external/smsService";

const allowedTypes = ["email", "sms", "in_app"] as const;
const allowedCategories = ["general", "appointment", "payment"] as const;

const isAllowedType = (type: string) => allowedTypes.includes(type as (typeof allowedTypes)[number]);
const isAllowedCategory = (category: string) =>
  allowedCategories.includes(category as (typeof allowedCategories)[number]);

// Send notification to a single user
export const sendNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      recipient,
      type,
      category,
      subject,
      message,
      metadata,
      actions,
      context,
      expiresAt
    } = req.body;

    if (!recipient || !type || !category || !subject || !message) {
      return next(errorHandler(400, "All fields are required"));
    }

    if (!isAllowedType(type)) {
      return next(errorHandler(400, "Invalid notification type"));
    }

    if (!isAllowedCategory(category)) {
      return next(errorHandler(400, "Invalid notification category"));
    }

    const recipientUser = await User.findById(recipient).select("email phone");
    if (!recipientUser) {
      return next(errorHandler(404, "Recipient not found"));
    }

    const notification = new Notification({
      recipient,
      recipientModel: "User",
      type,
      category,
      subject,
      message,
      metadata,
      actions,
      context,
      expiresAt,
      status: "pending"
    });

    await notification.save();

    try {
      if (type === "email") {
        if (!recipientUser.email) {
          throw errorHandler(400, "Recipient email is missing");
        }
        await sendGenericEmail(recipientUser.email, subject, message);
      } else if (type === "sms") {
        if (!recipientUser.phone) {
          throw errorHandler(400, "Recipient phone is missing");
        }
        await sendGenericSMS(recipientUser.phone, message);
      } else if (type === "in_app") {
        const io = req.app.get("io");
        if (io) {
          io.to(`user_${recipient}`).emit("notification", {
            notificationId: notification._id,
            category,
            subject,
            message,
            actions,
            context,
            expiresAt,
            metadata,
            createdAt: notification.createdAt
          });
        }
      }

      notification.status = "sent";
      notification.sentAt = new Date();
    } catch (sendError: any) {
      console.error("Send notification error:", sendError);
      notification.status = "failed";
    }

    await notification.save();

    res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      data: { notification }
    });
  } catch (error: any) {
    console.error("Send notification error:", error);
    next(errorHandler(500, "Server error while sending notification"));
  }
};

// Get user notifications with filters
export const getUserNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, category, status, type } = req.query;
    const query: any = { recipient: req.user?._id };

    if (category && isAllowedCategory(String(category))) {
      query.category = category;
    }

    if (type && isAllowedType(String(type))) {
      query.type = type;
    }

    if (status === "unread") {
      query.readAt = null;
    } else if (status === "read") {
      query.readAt = { $ne: null };
    } else if (status && ["pending", "sent", "failed"].includes(String(status))) {
      query.status = status;
    }

    const pageNumber = parseInt(page as string, 10);
    const pageLimit = parseInt(limit as string, 10);

    const notifications = await Notification.find(query)
      .populate("recipient", "firstName lastName email phone")
      .sort({ createdAt: "desc" })
      .limit(pageLimit)
      .skip((pageNumber - 1) * pageLimit);

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / pageLimit),
          totalNotifications: total,
          hasNextPage: pageNumber < Math.ceil(total / pageLimit),
          hasPrevPage: pageNumber > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get user notifications error:", error);
    next(errorHandler(500, "Server error while fetching notifications"));
  }
};

// Get a single notification
export const getNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findById(notificationId)
      .populate("recipient", "firstName lastName email phone");

    if (!notification) {
      return next(errorHandler(404, "Notification not found"));
    }

    const recipientId = notification.recipient && (notification.recipient as any)._id 
      ? (notification.recipient as any)._id.toString() 
      : notification.recipient.toString();

    if (recipientId !== req.user?._id?.toString()) {
      return next(errorHandler(403, "You can only access your own notifications"));
    }

    res.status(200).json({
      success: true,
      data: { notification }
    });
  } catch (error: any) {
    console.error("Get notification error:", error);
    next(errorHandler(500, "Server error while fetching notification"));
  }
};

// Mark a notification as read
export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return next(errorHandler(404, "Notification not found"));
    }

    const recipientId = notification.recipient && (notification.recipient as any)._id 
      ? (notification.recipient as any)._id.toString() 
      : notification.recipient.toString();

    if (recipientId !== req.user?._id?.toString()) {
      return next(errorHandler(403, "You can only mark your own notifications as read"));
    }

    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: { notification }
    });
  } catch (error: any) {
    console.error("Mark as read error:", error);
    next(errorHandler(500, "Server error while marking notification as read"));
  }
};

// Mark all notifications as read
export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user?._id, readAt: null },
      { readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: { count: result.modifiedCount }
    });
  } catch (error: any) {
    console.error("Mark all as read error:", error);
    next(errorHandler(500, "Server error while marking notifications as read"));
  }
};

// Delete a notification
export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return next(errorHandler(404, "Notification not found"));
    }

    const recipientId = notification.recipient && (notification.recipient as any)._id 
      ? (notification.recipient as any)._id.toString() 
      : notification.recipient.toString();

    if (recipientId !== req.user?._id?.toString()) {
      return next(errorHandler(403, "You can only delete your own notifications"));
    }

    await Notification.findByIdAndDelete(notificationId);

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete notification error:", error);
    next(errorHandler(500, "Server error while deleting notification"));
  }
};

// Get unread count
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user?._id,
      readAt: null
    });

    res.status(200).json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error: any) {
    console.error("Get unread count error:", error);
    next(errorHandler(500, "Server error while fetching unread count"));
  }
};

// Get all unread notifications
export const getUnreadNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { limit = 50 } = req.query;
    const notifications = await Notification.find({
      recipient: req.user?._id,
      readAt: null
    })
      .populate("recipient", "firstName lastName email phone")
      .sort({ createdAt: "desc" })
      .limit(parseInt(limit as string, 10));

    res.status(200).json({
      success: true,
      data: {
        notifications,
        count: notifications.length
      }
    });
  } catch (error: any) {
    console.error("Get unread notifications error:", error);
    next(errorHandler(500, "Server error while fetching unread notifications"));
  }
};

// Get notifications by category
export const getNotificationsByCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category } = req.params;
    if (!category) {
      return next(errorHandler(400, "Notification category is required"));
    }

    const categoryValue = String(category);
    if (!isAllowedCategory(categoryValue)) {
      return next(errorHandler(400, "Invalid notification category"));
    }

    const notifications = await Notification.find({
      recipient: req.user?._id,
      category: categoryValue
    })
      .populate("recipient", "firstName lastName email phone")
      .sort({ createdAt: "desc" })
      .limit(50);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        count: notifications.length
      }
    });
  } catch (error: any) {
    console.error("Get notifications by category error:", error);
    next(errorHandler(500, "Server error while fetching notifications"));
  }
};

// Send bulk notification to multiple users
export const sendBulkNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipients, type, category, subject, message } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return next(errorHandler(400, "Recipients array is required"));
    }

    if (!type || !category || !subject || !message) {
      return next(errorHandler(400, "All fields are required"));
    }

    if (!isAllowedType(type) || !isAllowedCategory(category)) {
      return next(errorHandler(400, "Invalid notification type or category"));
    }

    let successCount = 0;
    let failureCount = 0;

    for (const recipient of recipients) {
      try {
        const recipientUser = await User.findById(recipient).select("email phone");
        if (!recipientUser) {
          failureCount += 1;
          continue;
        }

        const notification = new Notification({
          recipient,
          recipientModel: "User",
          type,
          category,
          subject,
          message,
          status: "pending"
        });

        await notification.save();

        if (type === "email") {
          if (!recipientUser.email) {
            throw errorHandler(400, "Recipient email is missing");
          }
          await sendGenericEmail(recipientUser.email, subject, message);
        } else if (type === "sms") {
          if (!recipientUser.phone) {
            throw errorHandler(400, "Recipient phone is missing");
          }
          await sendGenericSMS(recipientUser.phone, message);
        } else if (type === "in_app") {
          const io = req.app.get("io");
          if (io) {
            io.to(`user_${recipient}`).emit("notification", {
              notificationId: notification._id,
              category,
              subject,
              message,
              createdAt: notification.createdAt
            });
          }
        }

        notification.status = "sent";
        notification.sentAt = new Date();
        await notification.save();
        successCount += 1;
      } catch (sendError) {
        failureCount += 1;
      }
    }

    res.status(200).json({
      success: true,
      message: "Bulk notification sent",
      data: {
        total: recipients.length,
        success: successCount,
        failed: failureCount
      }
    });
  } catch (error: any) {
    console.error("Send bulk notification error:", error);
    next(errorHandler(500, "Server error while sending bulk notifications"));
  }
};
