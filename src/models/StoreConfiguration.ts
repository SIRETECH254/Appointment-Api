import mongoose, { Schema } from "mongoose";
import type { IStoreConfiguration } from "../types/index";

const storeConfigurationSchema = new Schema<IStoreConfiguration>(
  {
    appointmentFeeType: {
      type: String,
      enum: ["FIXED", "PERCENTAGE"],
      required: [true, "Appointment fee type is required"],
      default: "FIXED"
    },
    appointmentFeeValue: {
      type: Number,
      required: [true, "Appointment fee value is required"],
      min: [0, "Appointment fee value cannot be negative"],
      default: 200
    },
    currency: {
      type: String,
      enum: ["KES"],
      required: [true, "Currency is required"],
      default: "KES"
    },
    minBookingNotice: {
      type: Number,
      required: [true, "Minimum booking notice is required"],
      min: [0, "Minimum booking notice cannot be negative"],
      default: 60
    },
    lateGracePeriod: {
      type: Number,
      required: [true, "Late grace period is required"],
      min: [0, "Late grace period cannot be negative"],
      default: 10
    },
    allowWalkIns: {
      type: Boolean,
      required: true,
      default: true
    },
    notificationSettings: {
      sendSMS: {
        type: Boolean,
        required: true,
        default: true
      },
      sendEmail: {
        type: Boolean,
        required: true,
        default: true
      },
      sendPush: {
        type: Boolean,
        required: true,
        default: false
      },
      reminderTimes: {
        type: [Number],
        default: [1440, 120, 30],
        validate: {
          validator: (values: number[]) => values.every((value) => value >= 0),
          message: "Reminder times must be zero or positive minutes"
        }
      }
    },
    businessHoursTimezone: {
      type: String,
      enum: ["Africa/Nairobi"],
      required: [true, "Business hours timezone is required"],
      default: "Africa/Nairobi"
    }
  },
  {
    timestamps: true
  }
);

const StoreConfiguration = mongoose.model<IStoreConfiguration>(
  "StoreConfiguration",
  storeConfigurationSchema
);

export default StoreConfiguration;
