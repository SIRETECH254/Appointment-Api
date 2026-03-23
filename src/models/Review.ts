import mongoose, { Schema } from "mongoose";
import type { IReview } from "../types/index";

const reviewSchema = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"]
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: [true, "Appointment is required"]
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating must be at most 5"]
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"]
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "APPROVED"
    }
  },
  { timestamps: true }
);

reviewSchema.index({ userId: 1 });
reviewSchema.index({ appointmentId: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ createdAt: -1 });

const Review = mongoose.model<IReview>("Review", reviewSchema);

export default Review;
