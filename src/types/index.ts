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

export interface IService extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string | null;
  duration: number;
  fullPrice: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAppointment extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  staffId: Types.ObjectId;
  services: Types.ObjectId[];
  startTime: Date;
  endTime: Date;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  bookingFeeAmount: number;
  remainingAmount: number;
  checkedInAt?: Date;
  actualEndTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment extends Document {
  _id: Types.ObjectId;
  customerId?: Types.ObjectId;
  appointmentId?: Types.ObjectId;
  paymentNumber: string;
  amount: number;
  currency: "KES";
  type: "BOOKING_FEE" | "FULL_PAYMENT";
  method: "MPESA" | "CARD" | "CASH";
  status: "PENDING" | "SUCCESS" | "FAILED";
  transactionRef?: string;
  processorRefs?: {
    daraja?: { merchantRequestId?: string; checkoutRequestId?: string };
    paystack?: { reference?: string };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IBreak extends Document {
  _id: Types.ObjectId;
  staffId: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  reason?: string;
  createdAt: Date;
}

export interface IContact extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  userId?: Types.ObjectId | null;
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
}

export interface IStoreConfiguration extends Document {
  _id: Types.ObjectId;
  appointmentFeeType: "FIXED" | "PERCENTAGE";
  appointmentFeeValue: number;
  currency: "KES";
  minBookingNotice: number;
  lateGracePeriod: number;
  allowWalkIns: boolean;
  notificationSettings: {
    sendSMS: boolean;
    sendEmail: boolean;
    sendPush: boolean;
    reminderTimes: number[];
  };
  businessHoursTimezone: "Africa/Nairobi";
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
