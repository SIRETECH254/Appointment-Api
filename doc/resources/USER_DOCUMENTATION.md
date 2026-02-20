# 👥 Appointment API - User Management Documentation

## 📋 Table of Contents
- [User Management Overview](#user-management-overview)
- [User Model](#-user-model)
- [User Controller](#-user-controller)
- [User Routes](#-user-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## User Management Overview

User Management covers all users in the unified system. All users authenticate via JWT and are assigned roles from the Role model. Users can have multiple roles assigned. Role-based access control (RBAC) governs permissions throughout the system. The default role for new registrations is "customer".

---

## 👤 User Model

### Schema Definition
```typescript
interface IUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roles: ObjectId[];
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string;
  avatarPublicId?: string;
  otpCode?: string;
  otpExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  lastLoginAt?: Date;
  services?: ObjectId[];
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
  fullName?: string;
  primaryRole?: IRole;
}
```

### Model Implementation

**File: `src/models/User.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IUser } from '../types/index';

const userSchema = new Schema<IUser>({
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName: { type: String, required: true, trim: true, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
  phone: { type: String, required: true, unique: true, trim: true },
  address: { type: String, trim: true, maxlength: 200 },
  city: { type: String, trim: true, maxlength: 50 },
  country: { type: String, trim: true, maxlength: 50 },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  avatar: { type: String, trim: true },
  avatarPublicId: { type: String, trim: true },
  otpCode: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpiry: { type: Date, select: false },
  lastLoginAt: { type: Date },
  services: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
  workingHours: {
    monday: [{ start: String, end: String }],
    tuesday: [{ start: String, end: String }],
    wednesday: [{ start: String, end: String }],
    thursday: [{ start: String, end: String }],
    friday: [{ start: String, end: String }],
    saturday: [{ start: String, end: String }],
    sunday: [{ start: String, end: String }]
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true }
  }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

userSchema.index({ roles: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ email: 1, isActive: 1 });

const User = mongoose.model<IUser>('User', userSchema);
export default User;
```

### Validation Rules
```typescript
firstName: { required: true, maxlength: 50 }
lastName:  { required: true, maxlength: 50 }
email:     { required: true, unique: true, format: email }
password:  { required: true, minlength: 6, select: false }
roles:     { type: Array, ref: 'Role' }
phone:     { required: true, unique: true }
address:   { optional, maxlength: 200 }
city:      { optional, maxlength: 50 }
country:   { optional, maxlength: 50 }
services:  { type: Array, ref: 'Service' }
workingHours: { optional, days: monday-sunday }
isActive:  { default: true }
emailVerified: { default: false }
```

---

## 🎮 User Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import validator from "validator";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";
import { deleteFromCloudinary, uploadToCloudinary } from "../config/cloudinary";
```

### Functions Overview

#### `getUserProfile()`
**Purpose:** Get current user profile  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Fetch profile and populate roles + services  
**Response:** User profile data

**Controller Implementation:**
```typescript
export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Load user with populated roles and services
    const user = await User.findById(req.user?._id)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName description permissions")
      .populate("services", "name duration fullPrice sortOrder isActive");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching user profile"));
  }
};
```

#### `updateUserProfile(updates)`
**Purpose:** Update current user profile  
**Access:** Authenticated users  
**Validation:**
- User must exist
- Phone must be valid and unique if provided
**Process:** Update profile fields and handle avatar changes  
**Response:** Updated profile summary

**Controller Implementation:**
```typescript
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Apply profile updates
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) {
      if (!validator.isMobilePhone(phone)) {
        return next(errorHandler(400, "Please provide a valid phone number"));
      }

      const existingUser = await User.findOne({
        phone,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return next(errorHandler(400, "Phone number is already taken by another user"));
      }

      user.phone = phone;
    }

    // Handle avatar upload via multipart/form-data
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "appointment/avatars");

      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || (typeof avatar === "string" && avatar.trim().length === 0)) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === "string" && avatar.trim().length > 0) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }

    await user.save();

    const roleIds = (user.roles || []).map((role: any) =>
      role?._id ? role._id.toString() : role.toString()
    );
    const staffRole = await Role.findOne({ name: "staff" }).select("_id");
    const isStaff = staffRole ? roleIds.includes(staffRole._id.toString()) : false;

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isActive: user.isActive,
          emailVerified: user.emailVerified
        }
      }
    });
  } catch (error: any) {
    if (error?.code === 11000 && error?.keyPattern?.phone) {
      return next(errorHandler(400, "Phone number is already taken by another user"));
    }
    next(errorHandler(500, "Server error while updating profile"));
  }
};
```

#### `changePassword(passwords)`
**Purpose:** Change user password  
**Access:** Authenticated users  
**Validation:**
- Current and new passwords required
- Current password must match
**Process:** Hash new password and save  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    // Require both current and new password
    if (!currentPassword || !newPassword) {
      return next(errorHandler(400, "Current password and new password are required"));
    }

    const user = await User.findById(req.user?._id).select("+password");
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Verify current password
    const ok = bcrypt.compareSync(currentPassword, user.password);
    if (!ok) {
      return next(errorHandler(400, "Current password is incorrect"));
    }

    // Hash and store new password
    user.password = bcrypt.hashSync(newPassword, 12);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while changing password"));
  }
};
```

#### `getNotificationPreferences()`
**Purpose:** Fetch notification preference settings  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Return preferences object (defaults to empty)  
**Response:** Preferences object

**Controller Implementation:**
```typescript
export const getNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Fetch notification preferences only
    const user = await User.findById(req.user?._id).select("notificationPreferences");
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { notificationPreferences: user.notificationPreferences || {} }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching notification preferences"));
  }
};
```

#### `updateNotificationPreferences(preferences)`
**Purpose:** Update notification preferences  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Update email/sms/inApp flags  
**Response:** Updated preferences

**Controller Implementation:**
```typescript
export const updateNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, sms, inApp } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Merge provided preferences
    user.notificationPreferences = user.notificationPreferences || {};
    if (email !== undefined) user.notificationPreferences.email = email;
    if (sms !== undefined) user.notificationPreferences.sms = sms;
    if (inApp !== undefined) user.notificationPreferences.inApp = inApp;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      data: { notificationPreferences: user.notificationPreferences }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating notification preferences"));
  }
};
```

#### `getAllUsers(query)`
**Purpose:** List users with filters  
**Access:** Admin/Staff  
**Validation:**
- Optional role must exist
**Process:** Search/filter users and return paginated results  
**Response:** Users + pagination

**Controller Implementation:**
```typescript
export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const query: any = {};

    // Apply text search filters
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    // Resolve role name to role id
    if (role) {
      const roleDoc = await Role.findOne({ name: String(role).toLowerCase() });
      if (!roleDoc) {
        return next(errorHandler(404, "Role not found"));
      }
      query.roles = roleDoc._id;
    }

    // Status filters
    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;
    if (status === "verified") query.emailVerified = true;
    else if (status === "unverified") query.emailVerified = false;

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query users with pagination
    const users = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalUsers: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching users"));
  }
};
```

#### `getUserById(userId)`
**Purpose:** Fetch user by id  
**Access:** Admin/Staff  
**Validation:** User must exist  
**Process:** Fetch user and populate roles + services  
**Response:** User details

**Controller Implementation:**
```typescript
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    // Load target user with role and service details
    const user = await User.findById(userId)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName description permissions")
      .populate("services", "name duration fullPrice sortOrder isActive");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching user"));
  }
};
```

#### `updateUser(userId, updates)`
**Purpose:** Update a user record  
**Access:** Admin  
**Validation:**
- User must exist
- Email format and uniqueness (if provided)
 - `workingHours` must be an object if provided
**Process:** Update profile fields and save  
**Response:** Updated user

**Controller Implementation:**
```typescript
export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, email, avatar, workingHours } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Apply admin edits
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    if (email) {
      // Validate and enforce unique email
      if (!validator.isEmail(email)) {
        return next(errorHandler(400, "Please provide a valid email"));
      }

      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });

      if (existingUser) {
        return next(errorHandler(400, "Email is already taken by another user"));
      }

      user.email = email.toLowerCase();
    }

    if (workingHours !== undefined) {
      if (typeof workingHours !== "object" || Array.isArray(workingHours)) {
        return next(errorHandler(400, "workingHours must be an object"));
      }
      user.workingHours = workingHours;
    }

    // Handle avatar upload via multipart/form-data
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "appointment/avatars");

      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || (typeof avatar === "string" && avatar.trim().length === 0)) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === "string" && avatar.trim().length > 0) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isActive: user.isActive,
          ...(isStaff && {
            workingHours: user.workingHours,
            services: user.services
          })
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating user"));
  }
};
```

#### `updateUserStatus(userId, status)`
**Purpose:** Activate or deactivate a user  
**Access:** Admin  
**Validation:** User must exist  
**Process:** Update `isActive` and save  
**Response:** Updated status

**Controller Implementation:**
```typescript
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const user = await User.findById(userId);

    // Ensure user exists
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Apply status change if provided
    if (isActive !== undefined) user.isActive = isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating user status"));
  }
};
```

#### `setUserAdmin(userId)`
**Purpose:** Set user role to a single role (legacy)  
**Access:** Admin  
**Validation:**
- User must exist
- Role must be valid and exist
**Process:** Replace roles array with selected role  
**Response:** Updated role list

**Controller Implementation:**
```typescript
export const setUserAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Validate role against allowed list
    const validRoles = ["admin", "staff", "customer"];
    if (!validRoles.includes(role)) {
      return next(errorHandler(400, "Invalid role"));
    }

    // Resolve role document
    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return next(errorHandler(404, "Role not found"));
    }

    // Replace roles array with a single role
    user.roles = [roleDoc._id];
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully`,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating user admin status"));
  }
};
```

#### `getUserRoles(userId)`
**Purpose:** Get roles for a user  
**Access:** Admin/Staff  
**Validation:** User must exist  
**Process:** Populate role details  
**Response:** Role list

**Controller Implementation:**
```typescript
export const getUserRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    // Load user with role details
    const user = await User.findById(userId).populate("roles", "name displayName description permissions");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching user roles"));
  }
};
```

#### `deleteUser(userId)`
**Purpose:** Delete user account  
**Access:** Admin  
**Validation:**
- User must exist
- Admin cannot delete own account
**Process:** Delete user by id  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    // Prevent deleting self
    if (req.user && String(req.user._id) === String(userId)) {
      return next(errorHandler(400, "You cannot delete your own account"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Delete user record
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while deleting user"));
  }
};
```

#### `adminCreateCustomer(userData)`
**Purpose:** Admin creates customer  
**Access:** Admin/Staff  
**Validation:**
- Required fields (firstName, lastName, email, phone)
- Unique email or phone
- Role exists (defaults to customer)
**Process:** Create user with default password and role  
**Response:** Created user summary

**Controller Implementation:**
```typescript
export const adminCreateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, phone, roleName, address, city, country } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone) {
      return next(errorHandler(400, "firstName, lastName, email and phone are required"));
    }

    // Enforce unique email/phone
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });
    if (existing) {
      return next(
        errorHandler(400, `A user with this ${existing.email === email ? "email" : "phone"} already exists`)
      );
    }

    // Hash phone as initial password
    const passwordHash = bcrypt.hashSync(String(phone), 12);
    const roleToAssign = roleName ? String(roleName).toLowerCase() : "customer";
    // Resolve role for assignment
    const roleDoc = await Role.findOne({ name: roleToAssign });
    if (!roleDoc) {
      return next(errorHandler(404, "Role not found"));
    }

    // Create user document
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: passwordHash,
      roles: [roleDoc._id],
      address,
      city,
      country,
      isActive: true,
      emailVerified: false
    });

    // Populate roles for response
    await user.populate("roles", "name displayName");

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          address: user.address,
          city: user.city,
          country: user.country,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while creating customer"));
  }
};
```

#### `assignRole(userId, roleId)`
**Purpose:** Assign a role to user  
**Access:** Admin  
**Validation:**
- roleName required
- User and role must exist
**Process:** Add role if not already assigned  
**Response:** Updated roles

**Controller Implementation:**
```typescript
export const assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;

    // Require role name
    if (!roleName) {
      return next(errorHandler(400, "roleName is required"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Lookup role by name
    const roleDoc = await Role.findOne({ name: String(roleName).toLowerCase() });
    if (!roleDoc) {
      return next(errorHandler(404, "Role not found"));
    }

    // Add role if not already assigned
    const roleId = roleDoc._id.toString();
    const normalizedRoles = (user.roles || []).map((role: any) => (role?._id ? role._id : role));
    const hasRole = normalizedRoles.some((role: any) => role.toString() === roleId);
    if (!hasRole) {
      user.roles = [...normalizedRoles, roleDoc._id] as any;
      await user.save();
    }

    // Populate roles for response
    await user.populate("roles", "name displayName");

    res.status(200).json({
      success: true,
      message: "Role assigned successfully",
      data: {
        user: {
          id: user._id,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while assigning role"));
  }
};
```

#### `removeRole(userId, roleId)`
**Purpose:** Remove a role from user  
**Access:** Admin  
**Validation:**
- User and role must exist
**Process:** Remove role and save  
**Response:** Updated roles

**Controller Implementation:**
```typescript
export const removeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, roleId } = req.params;
    const user = await User.findById(userId);

    // Ensure user exists
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Normalize roles and enforce at least one role
    const currentRoles = (user.roles || []).map((role: any) => (role?._id ? role._id : role));
    if (currentRoles.length <= 1) {
      return next(errorHandler(400, "User must have at least one role"));
    }

    // Remove role from user
    user.roles = currentRoles.filter((role: any) => role.toString() !== roleId) as any;
    await user.save();
    await user.populate("roles", "name displayName");

    res.status(200).json({
      success: true,
      message: "Role removed successfully",
      data: {
        user: {
          id: user._id,
          roles: user.roles
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while removing role"));
  }
};
```

#### `getCustomers(query)`
**Purpose:** List users with customer role  
**Access:** Admin/Staff  
**Validation:** Customer role must exist  
**Process:** Filter customers with pagination and status filters  
**Response:** Users + pagination

**Controller Implementation:**
```typescript
export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const customerRole = await Role.findOne({ name: "customer" });

    // Ensure customer role exists
    if (!customerRole) {
      return next(errorHandler(404, "Customer role not found. Please run seed script first."));
    }

    // Build query filters
    const query: any = { roles: customerRole._id };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    if (status === "verified") {
      query.emailVerified = true;
    } else if (status === "unverified") {
      query.emailVerified = false;
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query customers with pagination
    const customers = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        customers,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalCustomers: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching customers"));
  }
}
```

#### `getStaff(query)`
**Purpose:** List users with staff role  
**Access:** Authenticated users  
**Validation:** Staff role must exist  
**Process:** Filter staff with pagination and status filters  
**Response:** Users + pagination

**Controller Implementation:**
```typescript
export const getStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const staffRole = await Role.findOne({ name: "staff" });

    // Ensure staff role exists
    if (!staffRole) {
      return next(errorHandler(404, "Staff role not found. Please run seed script first."));
    }

    // Build query filters
    const query: any = { roles: staffRole._id };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    if (status === "verified") {
      query.emailVerified = true;
    } else if (status === "unverified") {
      query.emailVerified = false;
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query staff with pagination
    const staff = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .populate("services", "name duration fullPrice sortOrder isActive")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        staff,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalStaff: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching staff"));
  }
};
```


## 🛣️ User Routes

### Base Path: `/api/users`

```typescript
GET    /profile                  // Get current user profile
PUT    /profile                  // Update own profile
PUT    /change-password          // Change password
GET    /notifications            // Get notification preferences
PUT    /notifications            // Update notification preferences
POST   /admin-create             // Admin create customer
GET    /customers                // Get customers (admin)
GET    /staff                    // Get staff (any authenticated user)
GET    /                         // Get all users (admin)
GET    /:userId                  // Get single user (admin)
PUT    /:userId                  // Update user (admin)
PUT    /:userId/status           // Update user status (admin)
PUT    /:userId/admin            // Set user admin role (admin)
GET    /:userId/roles            // Get user roles (admin)
DELETE /:userId                  // Delete user (admin)
POST   /:userId/roles            // Assign role to user (admin)
DELETE /:userId/roles/:roleId    // Remove role from user (admin)
```



### Router Implementation

**File: `src/routes/userRoutes.ts`**

```typescript
import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  getNotificationPreferences,
  updateNotificationPreferences,
  getAllUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  setUserAdmin,
  getUserRoles,
  deleteUser,
  adminCreateCustomer,
  assignRole,
  removeRole,
  getCustomers,
  getStaff
} from '../controllers/userController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/profile', authenticateToken, getUserProfile);

router.put('/profile', authenticateToken, updateUserProfile);

router.put('/change-password', authenticateToken, changePassword);

router.get('/notifications', authenticateToken, getNotificationPreferences);

router.put('/notifications', authenticateToken, updateNotificationPreferences);

router.post('/admin-create', authenticateToken, authorizeRoles(['admin']), adminCreateCustomer);

router.get('/customers', authenticateToken, authorizeRoles(['admin']), getCustomers);

router.get('/staff', authenticateToken, getStaff);

router.get('/', authenticateToken, authorizeRoles(['admin']), getAllUsers);

router.get('/:userId', authenticateToken, authorizeRoles(['admin']), getUserById);

router.put('/:userId', authenticateToken, authorizeRoles(['admin']), updateUser);

router.put('/:userId/status', authenticateToken, authorizeRoles(['admin']), updateUserStatus);

router.put('/:userId/admin', authenticateToken, requireAdmin, setUserAdmin);

router.get('/:userId/roles', authenticateToken, authorizeRoles(['admin']), getUserRoles);

router.delete('/:userId', authenticateToken, requireAdmin, deleteUser);

router.post('/:userId/roles', authenticateToken, requireAdmin, assignRole);

router.delete('/:userId/roles/:roleId', authenticateToken, requireAdmin, removeRole);

export default router;
```

### Route Details

#### `GET /api/users/profile`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "john@company.com",
      "services": [
        {
          "_id": "...",
          "name": "Haircut",
          "duration": 30,
          "fullPrice": 500,
          "sortOrder": 1,
          "isActive": true
        }
      ]
    }
  }
}
```
**Notes:**
- `services` is populated for staff users who have assigned services.

#### `PUT /api/users/profile`
**Headers:** `Authorization: Bearer <token>`
**Body (JSON):**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+254712345679",
  "avatar": "https://example.com/avatar.jpg"
}
```
**Body (multipart/form-data):**
- Field `avatar` (file) for image upload
- Optional text fields: `firstName`, `lastName`, `phone`
**Notes:**
- To remove the avatar, send `avatar: null` or an empty string in JSON.
- If a new file is uploaded, the previous Cloudinary asset is deleted.
**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

#### `PUT /api/users/change-password`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### `GET /api/users/notifications`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "notificationPreferences": {
      "email": true,
      "sms": true,
      "inApp": true
    }
  }
}
```

#### `PUT /api/users/notifications`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "email": true,
  "sms": false,
  "inApp": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Notification preferences updated successfully"
}
```

#### `POST /api/users/admin-create`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Customer",
  "email": "jane@customer.com",
  "phone": "+254712345680",
  "roleName": "customer",
  "address": "456 Main St",
  "city": "Nairobi",
  "country": "Kenya"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "jane@customer.com"
    }
  }
}
```

#### `GET /api/users`
**Headers:** `Authorization: Bearer <admin_token>`
**Query:** `page`, `limit`, `search`, `role`, `status`
**Response:**
```json
{
  "success": true,
  "data": {
    "users": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalUsers": 0
    }
  }
}
```
**Notes:**
- `services` is populated for staff users who have assigned services.

#### `GET /api/users/customers`
**Headers:** `Authorization: Bearer <admin_token>`
**Query:** `page`, `limit`, `search`, `status`
**Response:**
```json
{
  "success": true,
  "data": {
    "customers": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCustomers": 0
    }
  }
}
```

#### `GET /api/users/staff`
**Headers:** `Authorization: Bearer <token>`
**Query:** `page`, `limit`, `search`, `status`
**Response:**
```json
{
  "success": true,
  "data": {
    "staff": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalStaff": 0
    }
  }
}
```
**Notes:**
- `services` is populated for staff users who have assigned services.
```

#### `GET /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "john@company.com",
      "services": [
        {
          "_id": "...",
          "name": "Haircut",
          "duration": 30,
          "fullPrice": 500,
          "sortOrder": 1,
          "isActive": true
        }
      ]
    }
  }
}
```
**Notes:**
- `services` is populated for staff users who have assigned services.

#### `PUT /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`
**Body (JSON):**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+254712345679",
  "email": "john.smith@company.com",
  "avatar": "https://example.com/avatar.jpg",
  "workingHours": {
    "monday": [{ "start": "09:00", "end": "17:00" }],
    "tuesday": [{ "start": "09:00", "end": "17:00" }],
    "wednesday": [{ "start": "09:00", "end": "17:00" }],
    "thursday": [{ "start": "09:00", "end": "17:00" }],
    "friday": [{ "start": "09:00", "end": "17:00" }],
    "saturday": [],
    "sunday": []
  }
}
```
**Body (multipart/form-data):**
- Field `avatar` (file) for image upload
- Optional text fields: `firstName`, `lastName`, `phone`, `email`, `workingHours` (JSON string)
**Notes:**
- To remove the avatar, send `avatar: null` or an empty string in JSON.
- If a new file is uploaded, the previous Cloudinary asset is deleted.
**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "john.smith@company.com"
    }
  }
}
```
**Notes:**
- `workingHours` and `services` are returned only when the user has the `staff` role.

#### `PUT /api/users/:userId/status`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "isActive": false
}
```
**Response:**
```json
{
  "success": true,
  "message": "User status updated successfully"
}
```

#### `PUT /api/users/:userId/admin`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "role": "admin"
}
```
**Response:**
```json
{
  "success": true,
  "message": "User role updated to admin successfully"
}
```

#### `GET /api/users/:userId/roles`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "roles": []
    }
  }
}
```

#### `DELETE /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

#### `POST /api/users/:userId/roles`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "roleName": "staff"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Role assigned successfully",
  "data": {
    "user": {
      "id": "...",
      "roles": []
    }
  }
}
```

#### `DELETE /api/users/:userId/roles/:roleId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "message": "Role removed successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token  
**Usage:**
```typescript
router.get('/profile', authenticateToken, getUserProfile);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check user permissions  
**Usage:**
```typescript
router.get('/', authenticateToken, authorizeRoles(['admin']), getAllUsers);
```

#### `requireAdmin`
**Purpose:** Admin access only  
**Usage:**
```typescript
router.delete('/:userId', authenticateToken, requireAdmin, deleteUser);
```

#### `requireOwnershipOrAdmin`
**Purpose:** User owns resource OR is admin  
**Usage:**
```typescript
router.put('/profile', authenticateToken, requireOwnershipOrAdmin('userId'), updateUserProfile);
```

---

## 📝 API Examples

### Get Current User Profile
```bash
curl -X GET http://localhost:4500/api/users/profile \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "john@company.com"
    }
  }
}
```

### Update Profile
```bash
curl -X PUT http://localhost:4500/api/users/profile \
  -H "Authorization: Bearer <access_token>" \
  -F "firstName=John" \
  -F "lastName=Smith" \
  -F "phone=+254712345679" \
  -F "avatar=@/path/to/avatar.jpg"
```
**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

### Change Password
```bash
curl -X PUT http://localhost:4500/api/users/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "currentPassword": "oldPassword123",
    "newPassword": "newSecurePassword123"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Admin Create Customer
```bash
curl -X POST http://localhost:4500/api/users/admin-create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "firstName": "Jane",
    "lastName": "Customer",
    "email": "jane@customer.com",
    "phone": "+254712345680",
    "address": "456 Main St",
    "city": "Nairobi",
    "country": "Kenya"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "jane@customer.com"
    }
  }
}
```

---

## 🛡️ Security Features

- **RBAC:** Route-level authorization via `authenticateToken`, `authorizeRoles`, `requireAdmin`.
- **Least Privilege:** Sensitive actions limited to `admin` (delete, role changes).
- **Sensitive Fields Excluded:** Password, OTP, reset tokens never returned.
- **Ownership:** Self-service endpoints operate on `req.user._id`.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "User not found" }
```

---

## 📊 Database Indexes

```typescript
userSchema.index({ email: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ email: 1, isActive: 1 });
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
