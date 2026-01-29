import mongoose, { Schema } from "mongoose";
import type { IContact } from "../types/index";

const contactSchema = new Schema<IContact>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: 254
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: 2000
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    status: {
      type: String,
      enum: ["NEW", "READ", "REPLIED", "ARCHIVED"],
      default: "NEW"
    }
  },
  { timestamps: true }
);

contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ userId: 1 }, { sparse: true });

const Contact = mongoose.model<IContact>("Contact", contactSchema);

export default Contact;
