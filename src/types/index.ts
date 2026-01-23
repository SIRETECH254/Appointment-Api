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
  services?: Types.ObjectId[];
  workingHours?: {
    monday: Array<{ start: string; end: string }>;
    tuesday: Array<{ start: string; end: string }>;
    wednesday: Array<{ start: string; end: string }>;
    thursday: Array<{ start: string; end: string }>;
    friday: Array<{ start: string; end: string }>;
    saturday: Array<{ start: string; end: string }>;
    sunday: Array<{ start: string; end: string }>;
  };
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
  address?: string;
  city?: string;
  country?: string;
  lastLoginAt?: Date;
  services?: Types.ObjectId[];
  workingHours?: {
    monday: Array<{ start: string; end: string }>;
    tuesday: Array<{ start: string; end: string }>;
    wednesday: Array<{ start: string; end: string }>;
    thursday: Array<{ start: string; end: string }>;
    friday: Array<{ start: string; end: string }>;
    saturday: Array<{ start: string; end: string }>;
    sunday: Array<{ start: string; end: string }>;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationAction {
  id: string;
  label: string;
  type: "api" | "navigate" | "modal" | "confirm";
  endpoint?: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  payload?: Record<string, any>;
  route?: string;
  modal?: string;
  variant?: "primary" | "secondary" | "danger" | "success";
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface NotificationContext {
  resourceId: string;
  resourceType: string;
  additionalData?: Record<string, any>;
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  recipientModel: "User";
  type: "email" | "sms" | "in_app";
  category: "general" | "appointment" | "payment";
  subject: string;
  message: string;
  status: "pending" | "sent" | "failed";
  sentAt?: Date;
  readAt?: Date;
  actions?: NotificationAction[];
  context?: NotificationContext;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
