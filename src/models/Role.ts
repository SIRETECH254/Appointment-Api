import mongoose, { Schema } from "mongoose";
import type { IRole } from "../types/index";

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [50, "Role name cannot exceed 50 characters"]
    },
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
      maxlength: [100, "Display name cannot exceed 100 characters"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },
    permissions: [
      {
        type: String,
        trim: true
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    isSystemRole: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

roleSchema.index({ name: 1 });
roleSchema.index({ isActive: 1 });
roleSchema.index({ isSystemRole: 1 });

roleSchema.pre("findOneAndDelete", async function preDelete(next) {
  const role = await this.model.findOne(this.getQuery());
  if (role && role.isSystemRole) {
    throw new Error("Cannot delete system roles");
  }
  next();
});

const Role = mongoose.model<IRole>("Role", roleSchema);

export default Role;
