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
  company?: string;
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

### Validation Rules
```typescript
firstName: { required: true, maxlength: 50 }
lastName:  { required: true, maxlength: 50 }
email:     { required: true, unique: true, format: email }
password:  { required: true, minlength: 6, select: false }
roles:     { type: Array, ref: 'Role' }
phone:     { required: true, unique: true }
company:   { optional, maxlength: 100 }
address:   { optional, maxlength: 200 }
city:      { optional, maxlength: 50 }
country:   { optional, maxlength: 50 }
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

### Functions Overview
- `getUserProfile()` - Get current user profile (with roles populated)
- `updateUserProfile()` - Update own profile
- `changePassword()` - Change password
- `getNotificationPreferences()` - Get notification preferences
- `updateNotificationPreferences()` - Update notification preferences
- `getAllUsers()` - Get all users (admin) with role filtering
- `getUserById()` - Get single user (admin) with roles populated
- `updateUser()` - Update any user (admin)
- `updateUserStatus()` - Update user status (admin)
- `setUserAdmin()` - Set user admin role (admin) - DEPRECATED: Use assignRole instead
- `getUserRoles()` - Get user roles (admin)
- `deleteUser()` - Delete user (admin)
- `adminCreateCustomer()` - Admin creates a customer (assigns default "customer" role)
- `assignRole()` - Assign role to user (admin)
- `removeRole()` - Remove role from user (admin)
- `getCustomers()` - Get customers (users with customer role) (admin)

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

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token  

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check user permissions  

#### `requireAdmin`
**Purpose:** Admin access only  

#### `requireOwnershipOrAdmin`
**Purpose:** User owns resource OR is admin  

---

## 📝 API Examples

### Get Current User Profile
```bash
curl -X GET http://localhost:4500/api/users/profile \
  -H "Authorization: Bearer <access_token>"
```

### Update Profile
```bash
curl -X PUT http://localhost:4500/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+254712345679",
    "avatar": "https://example.com/avatar.jpg"
  }'
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
    "company": "Customer Corp",
    "address": "456 Main St",
    "city": "Nairobi",
    "country": "Kenya"
  }'
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
userSchema.index({ company: 1 });
userSchema.index({ email: 1, isActive: 1 });
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
