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
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import { errorHandler } from '../middleware/errorHandler';
import User from '../models/User';
import Role from '../models/Role';
```

### Controller Implementations

```typescript
// Get current user profile
export const getUserProfile = async (req, res, next) => {
  const user = await User.findById(req.user?._id)
    .select('-password -otpCode -resetPasswordToken')
    .populate('roles', 'name displayName description permissions');

  if (!user) return next(errorHandler(404, 'User not found'));

  res.status(200).json({ success: true, data: { user } });
};

// Update profile fields
export const updateUserProfile = async (req, res, next) => {
  const { firstName, lastName, phone, avatar } = req.body;
  const user = await User.findById(req.user?._id);

  if (!user) return next(errorHandler(404, 'User not found'));

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phone) user.phone = phone;

  if (avatar === null || (typeof avatar === 'string' && avatar.trim().length === 0)) {
    user.avatar = null;
    user.avatarPublicId = null;
  } else if (typeof avatar === 'string' && avatar.trim().length > 0) {
    user.avatar = avatar.trim();
    user.avatarPublicId = null;
  }

  await user.save();

  res.status(200).json({ success: true, message: 'Profile updated successfully', data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, avatar: user.avatar, roles: user.roles, isActive: user.isActive, emailVerified: user.emailVerified } } });
};
```

```typescript
// Change password
export const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return next(errorHandler(400, 'Current password and new password are required'));

  const user = await User.findById(req.user?._id).select('+password');
  if (!user) return next(errorHandler(404, 'User not found'));

  const ok = bcrypt.compareSync(currentPassword, user.password);
  if (!ok) return next(errorHandler(400, 'Current password is incorrect'));

  user.password = bcrypt.hashSync(newPassword, 12);
  await user.save();

  res.status(200).json({ success: true, message: 'Password changed successfully' });
};
```

```typescript
// Get notification preferences
export const getNotificationPreferences = async (req, res, next) => {
  const user = await User.findById(req.user?._id).select('notificationPreferences');
  if (!user) return next(errorHandler(404, 'User not found'));

  res.status(200).json({ success: true, data: { notificationPreferences: user.notificationPreferences || {} } });
};
```

```typescript
// Update notification preferences
export const updateNotificationPreferences = async (req, res, next) => {
  const { email, sms, inApp } = req.body;
  const user = await User.findById(req.user?._id);
  if (!user) return next(errorHandler(404, 'User not found'));

  user.notificationPreferences = user.notificationPreferences || {};
  if (email !== undefined) user.notificationPreferences.email = email;
  if (sms !== undefined) user.notificationPreferences.sms = sms;
  if (inApp !== undefined) user.notificationPreferences.inApp = inApp;

  await user.save();

  res.status(200).json({ success: true, message: 'Notification preferences updated successfully', data: { notificationPreferences: user.notificationPreferences } });
};
```

```typescript
// Get all users with filters
export const getAllUsers = async (req, res, next) => {
  const { page = 1, limit = 10, search, role, status } = req.query;
  const query = {};
  if (search) query.$or = [
    { firstName: { $regex: search, $options: 'i' } },
    { lastName: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } }
  ];
  if (role) {
    const roleDoc = await Role.findOne({ name: String(role).toLowerCase() });
    if (!roleDoc) return next(errorHandler(404, 'Role not found'));
    query.roles = roleDoc._id;
  }
  if (status === 'active') query.isActive = true;
  else if (status === 'inactive') query.isActive = false;
  if (status === 'verified') query.emailVerified = true;
  else if (status === 'unverified') query.emailVerified = false;
  const users = await User.find(query)
    .select('-password -otpCode -resetPasswordToken')
    .populate('roles', 'name displayName')
    .sort({ createdAt: 'desc' })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));
  const total = await User.countDocuments(query);
  res.status(200).json({ success: true, data: { users, pagination: { currentPage: Number(page), totalPages: Math.ceil(total / Number(limit)), totalUsers: total, hasNextPage: Number(page) < Math.ceil(total / Number(limit)), hasPrevPage: Number(page) > 1 } } });
};
```

```typescript
// Get user by ID
export const getUserById = async (req, res, next) => {
  const { userId } = req.params;
  const user = await User.findById(userId)
    .select('-password -otpCode -resetPasswordToken')
    .populate('roles', 'name displayName description permissions');
  if (!user) return next(errorHandler(404, 'User not found'));
  res.status(200).json({ success: true, data: { user } });
};
```

```typescript
// Update user by ID
export const updateUser = async (req, res, next) => {
  const { userId } = req.params;
  const { firstName, lastName, phone, email, avatar } = req.body;
  const user = await User.findById(userId);

  if (!user) return next(errorHandler(404, 'User not found'));

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phone) user.phone = phone;

  if (email) {
    if (!validator.isEmail(email)) return next(errorHandler(400, 'Please provide a valid email'));
    const existingUser = await User.findOne({ email: email.toLowerCase(), _id: { $ne: userId } });
    if (existingUser) return next(errorHandler(400, 'Email is already taken by another user'));
    user.email = email.toLowerCase();
  }

  if (avatar === null || (typeof avatar === 'string' && avatar.trim().length === 0)) {
    user.avatar = null;
    user.avatarPublicId = null;
  } else if (typeof avatar === 'string' && avatar.trim().length > 0) {
    user.avatar = avatar.trim();
    user.avatarPublicId = null;
  }

  await user.save();
  res.status(200).json({ success: true, message: 'User updated successfully', data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, avatar: user.avatar, roles: user.roles, isActive: user.isActive } } });
};
```

```typescript
// Update user status
export const updateUserStatus = async (req, res, next) => {
  const { userId } = req.params;
  const { isActive } = req.body;
  const user = await User.findById(userId);

  if (!user) return next(errorHandler(404, 'User not found'));

  if (isActive !== undefined) user.isActive = isActive;
  await user.save();

  res.status(200).json({ success: true, message: 'User status updated successfully', data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, isActive: user.isActive, roles: user.roles } } });
};
```

```typescript
// Set a single role (legacy)
export const setUserAdmin = async (req, res, next) => {
  const { userId } = req.params;
  const { role } = req.body;
  const user = await User.findById(userId);

  if (!user) return next(errorHandler(404, 'User not found'));

  const validRoles = ['admin', 'staff', 'customer'];
  if (!validRoles.includes(role)) return next(errorHandler(400, 'Invalid role'));

  const roleDoc = await Role.findOne({ name: role });
  if (!roleDoc) return next(errorHandler(404, 'Role not found'));

  user.roles = [roleDoc._id];
  await user.save();

  res.status(200).json({ success: true, message: `User role updated to ${role} successfully`, data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, roles: user.roles } } });
};
```

```typescript
// Get roles for a user
export const getUserRoles = async (req, res, next) => {
  const { userId } = req.params;
  const user = await User.findById(userId).populate('roles', 'name displayName description permissions');

  if (!user) return next(errorHandler(404, 'User not found'));

  res.status(200).json({ success: true, data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, roles: user.roles } } });
};
```

```typescript
// Delete user
export const deleteUser = async (req, res, next) => {
  const { userId } = req.params;
  if (req.user && String(req.user._id) === String(userId)) return next(errorHandler(400, 'You cannot delete your own account'));
  const user = await User.findById(userId);

  if (!user) return next(errorHandler(404, 'User not found'));

  await User.findByIdAndDelete(userId);

  res.status(200).json({ success: true, message: 'User deleted successfully' });
};
```

```typescript
// Admin create customer
export const adminCreateCustomer = async (req, res, next) => {
  const { firstName, lastName, email, phone, roleName, address, city, country } = req.body;
  if (!firstName || !lastName || !email || !phone) return next(errorHandler(400, 'firstName, lastName, email and phone are required'));
  const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
  if (existing) return next(errorHandler(400, `A user with this ${existing.email === email ? 'email' : 'phone'} already exists`));

  const passwordHash = bcrypt.hashSync(String(phone), 12);
  const roleToAssign = roleName ? String(roleName).toLowerCase() : 'customer';
  const roleDoc = await Role.findOne({ name: roleToAssign });
  if (!roleDoc) return next(errorHandler(404, 'Role not found'));

  const user = await User.create({ firstName, lastName, email: email.toLowerCase(), phone, password: passwordHash, roles: [roleDoc._id], address, city, country, isActive: true, emailVerified: false });

  await user.populate('roles', 'name displayName');

  res.status(201).json({ success: true, message: 'Customer created successfully', data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, roles: user.roles, address: user.address, city: user.city, country: user.country, isActive: user.isActive, emailVerified: user.emailVerified, createdAt: user.createdAt } } });
};
```

```typescript
// Assign role to user
export const assignRole = async (req, res, next) => {
  const { userId } = req.params;
  const { roleName } = req.body;
  if (!roleName) return next(errorHandler(400, 'roleName is required'));
  const user = await User.findById(userId);
  if (!user) return next(errorHandler(404, 'User not found'));
  const roleDoc = await Role.findOne({ name: String(roleName).toLowerCase() });
  if (!roleDoc) return next(errorHandler(404, 'Role not found'));

  const roleId = roleDoc._id.toString();
  const normalizedRoles = (user.roles || []).map(role => (role?._id ? role._id : role));
  const hasRole = normalizedRoles.some(role => role.toString() === roleId);
  if (!hasRole) {
    user.roles = [...normalizedRoles, roleDoc._id];
    await user.save();
  }

  await user.populate('roles', 'name displayName');

  res.status(200).json({ success: true, message: 'Role assigned successfully', data: { user: { id: user._id, roles: user.roles } } });
};
```

```typescript
// Remove role from user
export const removeRole = async (req, res, next) => {
  const { userId, roleId } = req.params;
  const user = await User.findById(userId);
  if (!user) return next(errorHandler(404, 'User not found'));

  const currentRoles = (user.roles || []).map(role => (role?._id ? role._id : role));
  if (currentRoles.length <= 1) return next(errorHandler(400, 'User must have at least one role'));

  user.roles = currentRoles.filter(role => role.toString() !== roleId);
  await user.save();
  await user.populate('roles', 'name displayName');

  res.status(200).json({ success: true, message: 'Role removed successfully', data: { user: { id: user._id, roles: user.roles } } });
};
```

```typescript
// Get customers by role
export const getCustomers = async (req, res, next) => {
  const { page = 1, limit = 10, search, status } = req.query;
  const customerRole = await Role.findOne({ name: 'customer' });
  if (!customerRole) return next(errorHandler(404, 'Customer role not found. Please run seed script first.'));

  const query = { roles: customerRole._id };
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  if (status === 'active') query.isActive = true;
  else if (status === 'inactive') query.isActive = false;
  if (status === 'verified') query.emailVerified = true;
  else if (status === 'unverified') query.emailVerified = false;

  const customers = await User.find(query)
    .select('-password -otpCode -resetPasswordToken')
    .populate('roles', 'name displayName')
    .sort({ createdAt: 'desc' })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));

  const total = await User.countDocuments(query);

  res.status(200).json({ success: true, data: { customers, pagination: { currentPage: Number(page), totalPages: Math.ceil(total / Number(limit)), totalCustomers: total, hasNextPage: Number(page) < Math.ceil(total / Number(limit)), hasPrevPage: Number(page) > 1 } } });
};
```

---

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
  getCustomers
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
      "email": "john@company.com"
    }
  }
}
```

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

#### `GET /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`
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

#### `PUT /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`
**Body (JSON):**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+254712345679",
  "email": "john.smith@company.com",
  "avatar": "https://example.com/avatar.jpg"
}
```
**Body (multipart/form-data):**
- Field `avatar` (file) for image upload
- Optional text fields: `firstName`, `lastName`, `phone`, `email`
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
