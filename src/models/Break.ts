import mongoose, { Schema } from "mongoose";
import type { IBreak } from "../types/index";

const breakSchema = new Schema<IBreak>(
  {
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Staff is required"]
    },
    startTime: {
      type: Date,
      required: [true, "Start time is required"]
    },
    endTime: {
      type: Date,
      required: [true, "End time is required"]
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [300, "Reason cannot exceed 300 characters"]
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

breakSchema.index({ staffId: 1, startTime: 1, endTime: 1 });

const Break = mongoose.model<IBreak>("Break", breakSchema);

export default Break;
