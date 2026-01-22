import mongoose, { Schema } from "mongoose";
import type { IUser } from "../types/index";

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"]
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false
    },
    roles: [
      {
        type: Schema.Types.ObjectId,
        ref: "Role"
      }
    ],
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, "Company cannot exceed 100 characters"]
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, "Address cannot exceed 200 characters"]
    },
    city: {
      type: String,
      trim: true,
      maxlength: [50, "City cannot exceed 50 characters"]
    },
    country: {
      type: String,
      trim: true,
      maxlength: [50, "Country cannot exceed 50 characters"]
    },
    isActive: {
      type: Boolean,
      default: true
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    avatar: {
      type: String,
      trim: true
    },
    avatarPublicId: {
      type: String,
      trim: true
    },
    otpCode: {
      type: String,
      select: false
    },
    otpExpiry: {
      type: Date,
      select: false
    },
    resetPasswordToken: {
      type: String,
      select: false
    },
    resetPasswordExpiry: {
      type: Date,
      select: false
    },
    lastLoginAt: {
      type: Date
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

userSchema.index({ email: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ company: 1 });
userSchema.index({ email: 1, isActive: 1 });

userSchema.virtual("fullName").get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.virtual("primaryRole").get(function primaryRole() {
  if (this.roles && Array.isArray(this.roles) && this.roles.length > 0) {
    return this.roles[0];
  }
  return null;
});

const User = mongoose.model<IUser>("User", userSchema);

export default User;
