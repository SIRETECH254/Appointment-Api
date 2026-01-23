# 🔔 Appointment API - Notification System Documentation

## 📋 Table of Contents
- [Notification Overview](#notification-overview)
- [Notification Model](#notification-model)
- [Notification Controller](#notification-controller)
- [Notification Instances](#notification-instances)
- [Bidirectional Notifications](#bidirectional-notifications)
- [Notification Routes](#notification-routes)
- [Notification Services](#notification-services)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 📢 Notification Overview

The Appointment API Notification System handles all notification-related operations for appointment lifecycle and payment events. Notifications are delivered via email, SMS, and in-app (Socket.io), with read tracking and optional bidirectional actions.

### Notification System Features
- **Multi-Channel Delivery** - Email, SMS, and in-app notifications
- **Appointment-Focused Categories** - General, appointment, payment
- **Real-Time Delivery** - Socket.io for instant in-app notifications
- **Read Status Tracking** - Mark as read/unread
- **Notification Preferences** - User-configurable preferences
- **Bulk Operations** - Mark all as read, batch sending
- **Priority Actions** - Optional action buttons for bidirectional flows
- **Notification History** - Complete notification log
- **Recipient Management** - User-only notifications

### Notification Types
1. **Email** - Email messages via SMTP
2. **SMS** - Text messages via Africa's Talking
3. **In-app** - Real-time notifications via Socket.io

### Notification Categories
1. **General** - System announcements, account updates
2. **Appointment** - Booking, reschedule, cancellation, reminders
3. **Payment** - Payment initiated, success, failed

---

## 🗄️ Notification Model

### Schema Definition
```typescript
interface INotification {
  _id: string;
  recipient: ObjectId;           // Reference to User
  recipientModel: 'User';
  type: 'email' | 'sms' | 'in_app';
  category: 'general' | 'appointment' | 'payment';
  subject: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  readAt?: Date;
  metadata?: Record<string, any>;

  // Bidirectional Notification Support
  actions?: NotificationAction[];
  context?: NotificationContext;
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface NotificationAction {
  id: string;
  label: string;
  type: 'api' | 'navigate' | 'modal' | 'confirm';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  payload?: Record<string, any>;
  route?: string;
  modal?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

interface NotificationContext {
  resourceId: string;
  resourceType: string;
  additionalData?: Record<string, any>;
}
```

### Key Features
- **User Recipient** - Notifications are sent to `User` recipients
- **Channel-Aware** - Email, SMS, and in-app supported
- **Category Organization** - Appointment-centric grouping
- **Status Tracking** - Delivery status and timestamps
- **Read Receipts** - `readAt` for unread status
- **Metadata Storage** - Extra context for the frontend
- **Actions** - Buttons for bidirectional flows

### Validation Rules
```typescript
recipient: { required: true, refPath: 'recipientModel' }
recipientModel: { required: true, enum: ['User'] }
type: { required: true, enum: ['email', 'sms', 'in_app'] }
category: { required: true, enum: ['general', 'appointment', 'payment'] }
subject: { required: true, maxlength: 200 }
message: { required: true }
status: { required: true, enum: ['pending', 'sent', 'failed'], default: 'pending' }
```

### Model Implementation

**File: `src/models/Notification.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { INotification } from '../types/index';

const notificationSchema = new Schema<INotification>({
  recipient: {
    type: Schema.Types.ObjectId,
    required: [true, 'Recipient is required'],
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    required: [true, 'Recipient model is required'],
    enum: {
      values: ['User'],
      message: 'Recipient model must be User'
    }
  },
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: {
      values: ['email', 'sms', 'in_app'],
      message: 'Type must be email, sms, or in_app'
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['general', 'appointment', 'payment'],
      message: 'Category must be general, appointment, or payment'
    }
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'sent', 'failed'],
      message: 'Status must be pending, sent, or failed'
    },
    default: 'pending'
  },
  sentAt: {
    type: Date
  },
  readAt: {
    type: Date
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  actions: [
    {
      id: { type: String },
      label: { type: String },
      type: { type: String },
      endpoint: { type: String },
      method: { type: String },
      payload: { type: Schema.Types.Mixed },
      route: { type: String },
      modal: { type: String },
      variant: { type: String },
      requiresConfirmation: { type: Boolean },
      confirmationMessage: { type: String }
    }
  ],
  context: {
    resourceId: { type: String },
    resourceType: { type: String },
    additionalData: { type: Schema.Types.Mixed }
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ category: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ readAt: 1 });
notificationSchema.index({ createdAt: -1 });

notificationSchema.virtual('isUnread').get(function() {
  return !this.readAt;
});

notificationSchema.set('toJSON', { virtuals: true });

const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
```

---

## 🎮 Notification Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Notification from "../models/Notification";
import User from "../models/User";
import { sendGenericEmail } from "../services/external/emailService";
import { sendGenericSMS } from "../services/external/smsService";
```

### Functions Overview

#### `sendNotification(notificationData)`
**Purpose:** Send notification to a user  
**Access:** Admin/Staff  
**Validation:**
- Required fields (recipient, type, category, subject, message)
- Type and category must be valid
- Recipient must exist
- Recipient email/phone required for email/SMS
**Process:**
- Create notification record
- Send via selected channel
- Emit Socket.io event for in-app
- Update status and sent time
**Response:** Created notification

**Controller Implementation:**
```typescript
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
```

#### `getUserNotifications(query)`
**Purpose:** Get user notifications with filters  
**Access:** Authenticated users  
**Validation:** Optional filter values must be valid  
**Process:** Filter by category/type/status with pagination  
**Response:** Paginated notifications

**Controller Implementation:**
```typescript
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
```

#### `getNotification(notificationId)`
**Purpose:** Fetch a single notification  
**Access:** Recipient only  
**Validation:** Notification must exist and belong to user  
**Process:** Fetch notification by id  
**Response:** Notification data

**Controller Implementation:**
```typescript
export const getNotification = async (
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

    if (notification.recipient.toString() !== req.user?._id?.toString()) {
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
```

#### `markAsRead(notificationId)`
**Purpose:** Mark one notification as read  
**Access:** Recipient only  
**Validation:** Notification must exist and belong to user  
**Process:** Set `readAt` timestamp  
**Response:** Updated notification

**Controller Implementation:**
```typescript
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

    if (notification.recipient.toString() !== req.user?._id?.toString()) {
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
```

#### `markAllAsRead()`
**Purpose:** Mark all notifications as read  
**Access:** Recipient only  
**Validation:** User must be authenticated  
**Process:** Update all unread notifications  
**Response:** Count of updated notifications

**Controller Implementation:**
```typescript
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
```

#### `deleteNotification(notificationId)`
**Purpose:** Delete a notification  
**Access:** Recipient only  
**Validation:** Notification must exist and belong to user  
**Process:** Delete notification by id  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
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

    if (notification.recipient.toString() !== req.user?._id?.toString()) {
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
```

#### `getUnreadCount()`
**Purpose:** Get unread count  
**Access:** Recipient only  
**Validation:** User must be authenticated  
**Process:** Count unread notifications  
**Response:** Unread count

**Controller Implementation:**
```typescript
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
```

#### `getUnreadNotifications()`
**Purpose:** Get all unread notifications  
**Access:** Recipient only  
**Validation:** User must be authenticated  
**Process:** Fetch unread notifications with limit  
**Response:** Unread list

**Controller Implementation:**
```typescript
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
```

#### `getNotificationsByCategory(category)`
**Purpose:** Filter notifications by category  
**Access:** Recipient only  
**Validation:** Category must be valid  
**Process:** Fetch notifications by category  
**Response:** Filtered list

**Controller Implementation:**
```typescript
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
```

#### `sendBulkNotification(recipients)`
**Purpose:** Send the same notification to multiple users  
**Access:** Admin  
**Validation:**
- Recipients array required
- Required fields (type, category, subject, message)
**Process:** Create notification per user and deliver by channel  
**Response:** Delivery summary

**Controller Implementation:**
```typescript
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
```

---

## 📍 Notification Instances

These instances cover appointment lifecycle + payment events.

### 📅 APPOINTMENT CONTROLLER (`appointmentController.ts`)

#### 1. `createAppointment` ✅ **PRIORITY: HIGH**
**Event:** Appointment created  
**Recipients:** User and assigned staff  
**Implementation:**
```typescript
await createInAppNotification({
  recipient: userId,
  recipientModel: 'User',
  category: 'appointment',
  subject: 'Appointment Confirmed',
  message: `Your appointment for ${serviceName} is confirmed on ${date}.`,
  metadata: { appointmentId },
  io: req.app.get('io')
});
```

#### 2. `rescheduleAppointment` ✅ **PRIORITY: HIGH**
**Event:** Appointment rescheduled  
**Recipients:** User and assigned staff  
**Implementation:**
```typescript
await createInAppNotification({
  recipient: userId,
  recipientModel: 'User',
  category: 'appointment',
  subject: 'Appointment Rescheduled',
  message: `Your appointment has been moved to ${newDate}.`,
  metadata: { appointmentId },
  io: req.app.get('io')
});
```

#### 3. `cancelAppointment` ✅ **PRIORITY: HIGH**
**Event:** Appointment canceled  
**Recipients:** User and assigned staff  
**Implementation:**
```typescript
await createInAppNotification({
  recipient: userId,
  recipientModel: 'User',
  category: 'appointment',
  subject: 'Appointment Canceled',
  message: `Your appointment on ${date} has been canceled.`,
  metadata: { appointmentId },
  io: req.app.get('io')
});
```

#### 4. `sendAppointmentReminder` ✅ **PRIORITY: MEDIUM**
**Event:** Appointment reminder  
**Recipients:** User  
**Implementation:**
```typescript
await createInAppNotification({
  recipient: userId,
  recipientModel: 'User',
  category: 'appointment',
  subject: 'Appointment Reminder',
  message: `Reminder: your appointment is on ${date} at ${time}.`,
  metadata: { appointmentId },
  io: req.app.get('io')
});
```

### 💳 PAYMENT CONTROLLER (`paymentController.ts`)

#### 5. `initiatePayment` ✅ **PRIORITY: HIGH**
**Event:** Payment initiated  
**Recipients:** User  
**Implementation:**
```typescript
await createInAppNotification({
  recipient: userId,
  recipientModel: 'User',
  category: 'payment',
  subject: 'Payment Initiated',
  message: `Payment of ${amount} for your appointment has been initiated.`,
  metadata: { paymentId, appointmentId },
  io: req.app.get('io')
});
```

#### 6. `paymentSuccess` ✅ **PRIORITY: HIGH**
**Event:** Payment successful  
**Recipients:** User  
**Implementation:**
```typescript
await createInAppNotification({
  recipient: userId,
  recipientModel: 'User',
  category: 'payment',
  subject: 'Payment Successful',
  message: `Your payment of ${amount} was successful.`,
  metadata: { paymentId, appointmentId },
  io: req.app.get('io')
});
```

#### 7. `paymentFailed` ⚠️ **PRIORITY: MEDIUM**
**Event:** Payment failed  
**Recipients:** User  
**Implementation:**
```typescript
await createInAppNotification({
  recipient: userId,
  recipientModel: 'User',
  category: 'payment',
  subject: 'Payment Failed',
  message: `Your payment could not be completed. Please try again.`,
  metadata: { paymentId, appointmentId },
  io: req.app.get('io')
});
```

---

## 🔄 Bidirectional Notifications

Bidirectional notifications include actions that the user can trigger directly.

### Example: Appointment Confirmation Actions
```typescript
await createInAppNotification({
  recipient: userId,
  recipientModel: 'User',
  category: 'appointment',
  subject: 'Appointment Confirmed',
  message: 'Your appointment is confirmed.',
  actions: [
    {
      id: 'reschedule',
      label: 'Reschedule',
      type: 'navigate',
      route: `/appointments/${appointmentId}/reschedule`,
      variant: 'secondary'
    },
    {
      id: 'cancel',
      label: 'Cancel Appointment',
      type: 'api',
      endpoint: `/api/appointments/${appointmentId}/cancel`,
      method: 'PATCH',
      variant: 'danger',
      requiresConfirmation: true,
      confirmationMessage: 'Cancel this appointment?'
    }
  ],
  context: {
    resourceId: appointmentId,
    resourceType: 'appointment'
  },
  metadata: { appointmentId },
  io: req.app.get('io')
});
```

---

## 🛣️ Notification Routes

### Base Path: `/api/notifications`

```typescript
POST   /                          // Send notification
GET    /                          // Get user notifications (paginated)
GET    /unread-count              // Get unread count
GET    /unread                    // Get unread notifications
GET    /category/:category        // Get notifications by category

GET    /:notificationId           // Get single notification
PATCH  /:notificationId/read      // Mark as read
PATCH  /read-all                  // Mark all as read
DELETE /:notificationId           // Delete notification

POST   /bulk                      // Send bulk notification
```

### Route Details

#### `POST /api/notifications`
**Headers:** `Authorization: Bearer <admin_or_staff_token>`  
**Body:**
```json
{
  "recipient": "user_id_here",
  "type": "in_app",
  "category": "appointment",
  "subject": "Appointment Updated",
  "message": "Your appointment has been updated",
  "metadata": { "appointmentId": "appt_id_here" }
}
```
**Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "data": { "notification": { "_id": "...", "status": "sent" } }
}
```

#### `GET /api/notifications`
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:** `page`, `limit`, `category`, `type`, `status`  
**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [],
    "pagination": { "currentPage": 1, "totalPages": 1, "totalNotifications": 0 }
  }
}
```

#### `GET /api/notifications/unread-count`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "data": { "unreadCount": 3 }
}
```

#### `GET /api/notifications/unread`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "data": { "notifications": [], "count": 0 }
}
```

#### `GET /api/notifications/category/:category`
**Headers:** `Authorization: Bearer <token>`  
**URL Parameter:** `category` = `general | appointment | payment`  
**Response:**
```json
{
  "success": true,
  "data": { "notifications": [], "count": 0 }
}
```

#### `GET /api/notifications/:notificationId`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "data": { "notification": { "_id": "...", "subject": "..." } }
}
```

#### `PATCH /api/notifications/:notificationId/read`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": { "notification": { "_id": "...", "readAt": "2026-01-01T00:00:00.000Z" } }
}
```

#### `PATCH /api/notifications/read-all`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": { "count": 5 }
}
```

#### `DELETE /api/notifications/:notificationId`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

#### `POST /api/notifications/bulk`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "recipients": ["user_id_1", "user_id_2"],
  "type": "in_app",
  "category": "general",
  "subject": "Maintenance",
  "message": "System maintenance scheduled tonight"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Bulk notification sent",
  "data": { "total": 2, "success": 2, "failed": 0 }
}
```

### Router Implementation

**File: `src/routes/notificationRoutes.ts`**

```typescript
import express from 'express';
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
} from '../controllers/notificationController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['admin', 'staff']), sendNotification);
router.get('/', authenticateToken, getUserNotifications);
router.get('/unread-count', authenticateToken, getUnreadCount);
router.get('/unread', authenticateToken, getUnreadNotifications);
router.get('/category/:category', authenticateToken, getNotificationsByCategory);
router.get('/:notificationId', authenticateToken, getNotification);
router.patch('/:notificationId/read', authenticateToken, markAsRead);
router.patch('/read-all', authenticateToken, markAllAsRead);
router.delete('/:notificationId', authenticateToken, deleteNotification);
router.post('/bulk', authenticateToken, authorizeRoles(['admin']), sendBulkNotification);

export default router;
```

---

## 📧 Notification Services

### Email Service
**File: `src/services/external/emailService.ts`**
```typescript
export const sendGenericEmail = async (email: string, subject: string, message: string) => {
  const transporter = createTransporter();
  const mailOptions = { from: fromEmail, to: email, subject, text: message };
  return transporter.sendMail(mailOptions);
};
```

### SMS Service
**File: `src/services/external/smsService.ts`**
```typescript
export const sendGenericSMS = async (phone: string, message: string) => {
  const formattedPhone = formatPhoneNumber(phone);
  const result = await sms.send({ to: [formattedPhone], message });
  return result;
};
```

### Real-Time Service (Socket.io)
```typescript
io.to(`user_${userId}`).emit('notification', payload);
```

---

## 🔐 Middleware

Notifications rely on standard middleware:
- **authenticateToken** - Ensure user is authenticated
- **authorizeRoles** - Restrict admin/staff-only actions

---

## 📝 API Examples

### Send Notification
```bash
curl -X POST http://localhost:4500/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "recipient": "user_id_here",
    "type": "in_app",
    "category": "appointment",
    "subject": "Appointment Updated",
    "message": "Your appointment has been updated",
    "metadata": { "appointmentId": "appt_id_here" }
  }'
```

### Get User Notifications
```bash
curl -X GET "http://localhost:4500/api/notifications?page=1&limit=10&category=appointment&status=unread" \
  -H "Authorization: Bearer <token>"
```

### Mark as Read
```bash
curl -X PATCH http://localhost:4500/api/notifications/<notificationId>/read \
  -H "Authorization: Bearer <token>"
```

---

## 🔒 Security Features

### Access Control
- **Recipient Verification** - Users only access their own notifications
- **Admin/Staff Sending** - Only staff can send system notifications
- **Preference Checks** - In-app notifications honor user preferences

### Input Validation
- **Required Fields** - Subject and message validation
- **Recipient Validation** - Ensure recipient exists
- **Type Validation** - Only supported types allowed

---

## 🚨 Error Handling

```json
{
  "success": false,
  "message": "Notification not found"
}
```

```json
{
  "success": false,
  "message": "You can only access your own notifications"
}
```

---

## 🔗 Integration with Other Modules

- **Users** - Preferences and recipient ownership
- **Appointments** - Booking, reschedule, cancellation, reminders
- **Payments** - Initiated, success, failed notifications
- **Realtime** - Socket.io for live updates

---

**Last Updated:** January 2026  
**Version:** 1.0.0  
**Maintainer:** Appointment API Team
