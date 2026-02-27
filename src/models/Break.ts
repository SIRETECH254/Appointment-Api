import mongoose, { Schema } from "mongoose";
import type { IBreak } from "../types/index";

// Validation function for HH:MM format
const validateTimeFormat = (time: string): boolean => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

const breakSchema = new Schema<IBreak>(
  {
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Staff is required"]
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      validate: {
        validator: validateTimeFormat,
        message: "Start time must be in HH:MM format (00:00 to 23:59)"
      }
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      validate: {
        validator: validateTimeFormat,
        message: "End time must be in HH:MM format (00:00 to 23:59)"
      }
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [300, "Reason cannot exceed 300 characters"]
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Validate that startTime < endTime
breakSchema.pre("save", function (next) {
  if (this.startTime && this.endTime) {
    if (this.startTime >= this.endTime) {
      return next(new Error("startTime must be earlier than endTime"));
    }
  }
  next();
});

// Index on staffId only (time strings don't need date-range indexes)
breakSchema.index({ staffId: 1 });

const Break = mongoose.model<IBreak>("Break", breakSchema);

export default Break;
