import mongoose, { Schema } from "mongoose";
import type { IPayment } from "../types/index";

const paymentSchema = new Schema<IPayment>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: [true, "Appointment is required"]
    },
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"]
    },
    currency: {
      type: String,
      enum: ["KES"],
      default: "KES",
      required: true
    },
    type: {
      type: String,
      enum: ["BOOKING_FEE", "FULL_PAYMENT"],
      required: true
    },
    method: {
      type: String,
      enum: ["MPESA", "CARD", "CASH"],
      required: true
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
      required: true
    },
    transactionRef: {
      type: String,
      trim: true
    },
    processorRefs: {
      daraja: {
        merchantRequestId: { type: String, trim: true },
        checkoutRequestId: { type: String, trim: true }
      },
      paystack: {
        reference: { type: String, trim: true }
      }
    }
  },
  { timestamps: true }
);

paymentSchema.index({ appointmentId: 1 });
paymentSchema.index({ paymentNumber: 1 }, { unique: true });
paymentSchema.index({ status: 1, createdAt: 1 });

const Payment = mongoose.model<IPayment>("Payment", paymentSchema);

export default Payment;
