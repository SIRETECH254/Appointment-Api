import mongoose, { Schema } from "mongoose";
import type { INotification } from "../types/index";

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      required: [true, "Recipient is required"],
      refPath: "recipientModel"
    },
    recipientModel: {
      type: String,
      required: [true, "Recipient model is required"],
      enum: {
        values: ["User"],
        message: "Recipient model must be User"
      }
    },
    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: {
        values: ["email", "sms", "in_app"],
        message: "Type must be email, sms, or in_app"
      }
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ["general", "appointment", "payment"],
        message: "Category must be general, appointment, or payment"
      }
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [200, "Subject cannot exceed 200 characters"]
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ["pending", "sent", "failed"],
        message: "Status must be pending, sent, or failed"
      },
      default: "pending"
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
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ category: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ readAt: 1 });
notificationSchema.index({ createdAt: -1 });

notificationSchema.virtual("isUnread").get(function () {
  return !this.readAt;
});

notificationSchema.set("toJSON", { virtuals: true });

const Notification = mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;
