import mongoose, { Schema } from "mongoose";
import type { INewsletter } from "../types/index";

const newsletterSchema = new Schema<INewsletter>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
      validate: {
        validator: function(v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please provide a valid email address"
      }
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    status: {
      type: String,
      enum: ["SUBSCRIBED", "UNSUBSCRIBED", "BOUNCED"],
      default: "SUBSCRIBED"
    },
    subscribedAt: {
      type: Date,
      default: Date.now
    },
    unsubscribedAt: {
      type: Date
    },
    unsubscribeToken: {
      type: String,
      unique: true,
      sparse: true
    },
    source: {
      type: String,
      enum: ["WEBSITE", "ADMIN", "API", "IMPORT"],
      default: "WEBSITE"
    },
    tags: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

// email index is automatically created by unique: true
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ subscribedAt: -1 });
newsletterSchema.index({ userId: 1 }, { sparse: true });
// unsubscribeToken index is automatically created by unique: true with sparse: true

const Newsletter = mongoose.model<INewsletter>("Newsletter", newsletterSchema);

export default Newsletter;
