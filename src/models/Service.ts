import mongoose, { Schema } from "mongoose";
import type { IService } from "../types/index";

const serviceSchema = new Schema<IService>(
  {
    name: {
      type: String,
      required: [true, "Service name is required"],
      unique: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    duration: {
      type: Number,
      required: [true, "Service duration is required"],
      min: [1, "Service duration must be at least 1 minute"]
    },
    fullPrice: {
      type: Number,
      required: [true, "Service full price is required"],
      min: [0, "Service full price cannot be negative"]
    },
    sortOrder: {
      type: Number,
      required: true,
      min: [0, "Sort order cannot be negative"],
      default: 0
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true
    }
  },
  { timestamps: true }
);

serviceSchema.index({ isActive: 1 });
serviceSchema.index({ sortOrder: 1 });

const Service = mongoose.model<IService>("Service", serviceSchema);

export default Service;
