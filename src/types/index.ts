import type { Document, Types } from "mongoose";

export interface IRole extends Document {
  _id: Types.ObjectId;
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roles: Types.ObjectId[] | IRole[];
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string | null;
  avatarPublicId?: string | null;
  otpCode?: string | undefined;
  otpExpiry?: Date | undefined;
  resetPasswordToken?: string | undefined;
  resetPasswordExpiry?: Date | undefined;
  lastLoginAt?: Date;
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserResponse {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roles: Types.ObjectId[] | IRole[];
  roleNames?: string[];
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string | null;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
