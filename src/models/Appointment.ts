import mongoose, { Schema } from "mongoose";
import type { IAppointment } from "../types/index";

const appointmentSchema = new Schema<IAppointment>(
  {
    appointmentNumber: {
      type: String,
      unique: true,
      required: [true, "Appointment number is required"]
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"]
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Staff is required"]
    },
    services: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service",
        required: [true, "Service is required"]
      }
    ],
    startTime: {
      type: Date,
      required: [true, "Start time is required"]
    },
    endTime: {
      type: Date,
      required: [true, "End time is required"]
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
      default: "PENDING",
      required: true
    },
    bookingFeeAmount: {
      type: Number,
      required: true,
      min: [0, "Booking fee cannot be negative"],
      default: 0
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: [0, "Remaining amount cannot be negative"],
      default: 0
    },
    checkedInAt: {
      type: Date
    },
    actualEndTime: {
      type: Date
    }
  },
  { timestamps: true }
);

appointmentSchema.index({ appointmentNumber: 1 });
appointmentSchema.index({ staffId: 1, startTime: 1, endTime: 1 });
appointmentSchema.index({ customerId: 1, startTime: 1 });
appointmentSchema.index({ services: 1 });

const Appointment = mongoose.model<IAppointment>("Appointment", appointmentSchema);

export default Appointment;
