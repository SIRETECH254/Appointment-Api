import Notification from "../models/Notification";
import User from "../models/User";
import { Server as SocketIOServer } from "socket.io";
import type { INotification, NotificationAction, NotificationContext } from "../types";

interface CreateInAppNotificationParams {
  recipient: string;
  recipientModel: "User";
  category: "general" | "appointment" | "payment";
  subject: string;
  message: string;
  actions?: NotificationAction[];
  context?: NotificationContext;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  io?: SocketIOServer;
}

export const createInAppNotification = async (
  params: CreateInAppNotificationParams
): Promise<INotification | null> => {
  try {
    const {
      recipient,
      recipientModel,
      category,
      subject,
      message,
      actions,
      context,
      expiresAt,
      metadata,
      io
    } = params;

    const recipientUser = await User.findById(recipient).select("notificationPreferences");
    if (recipientUser && recipientUser.notificationPreferences) {
      const inAppEnabled = recipientUser.notificationPreferences.inApp;
      if (inAppEnabled === false) {
        console.log(
          `In-app notification skipped for ${recipientModel} ${recipient}: preference disabled`
        );
        return null;
      }
    }

    const notification = new Notification({
      recipient,
      recipientModel,
      type: "in_app",
      category,
      subject,
      message,
      actions,
      context,
      expiresAt,
      metadata,
      status: "pending"
    });

    await notification.save();

    notification.status = "sent";
    notification.sentAt = new Date();
    await notification.save();

    if (io) {
      const roomId = `user_${recipient}`;
      io.to(roomId).emit("notification", {
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

    console.log(
      `In-app notification with actions sent to ${recipientModel} ${recipient}: ${subject}`
    );
    return notification;
  } catch (error) {
    console.error("Error creating in-app notification:", error);
    throw error;
  }
};
