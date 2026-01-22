# 🎭 Appointment API - Role Management System Documentation

## 📋 Table of Contents
- [Role Overview](#role-overview)
- [Role Model](#role-model)
- [Role Controller](#role-controller)
- [Role Routes](#role-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with User System](#integration-with-user-system)

---

## 🎭 Role Overview

The Appointment API uses a unified role-based access control (RBAC) system where all users are managed through a single User model with role assignments. Roles define user permissions and access levels throughout the system.

### Role System Features
- **Unified User Model** - All users use the same User model
- **Multiple Roles** - Users can have multiple roles assigned
- **Role Management** - Full CRUD operations for roles (admin only)
- **System Roles** - Protected default roles that cannot be deleted
- **Permission-Based** - Each role has an array of permissions
- **Presaved Roles** - Roles are stored in database and fetched dynamically

### Default Roles
- `customer` - Default role for customers (assigned on registration)
- `admin` - Full system access with all permissions
- `staff` - Basic admin access for staff members

---

## 🗄️ Role Model

### Schema Definition
```typescript
interface IRole extends Document {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Role.ts`**

```typescript
const roleSchema = new Schema<IRole>({
  name: { required: true, unique: true, lowercase: true, trim: true },
  displayName: { required: true, trim: true },
  description: { trim: true },
  permissions: [{ type: String, trim: true }],
  isActive: { default: true },
  isSystemRole: { default: false }
}, { timestamps: true });
```

### Default Roles Configuration
```typescript
{
  name: 'customer',
  displayName: 'Customer',
  description: 'Default role for customers',
  permissions: ['view_own_profile', 'update_own_profile', 'view_own_appointments'],
  isSystemRole: true
},
{
  name: 'admin',
  displayName: 'Admin',
  description: 'Full system access for administrators',
  permissions: ['*'],
  isSystemRole: true
},
{
  name: 'staff',
  displayName: 'Staff',
  description: 'Staff access for managing appointments and customers',
  permissions: ['view_customers', 'manage_appointments', 'view_services'],
  isSystemRole: true
}
```

---

## 🎮 Role Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Role from '../models/Role';
import User from '../models/User';
```

### Functions Overview
- `getAllRoles()` - Get all roles with optional filtering
- `getRole()` - Get single role details
- `createRole()` - Create new role (admin only)
- `updateRole()` - Update existing role (admin only)
- `deleteRole()` - Delete role (admin only)
- `getUsersByRole()` - Get all users with specific role (admin)
- `getCustomers()` - Get customers (users with "customer" role) (admin)

---

## 🛣️ Role Routes

### Base Path: `/api/roles`

```typescript
GET    /                          // Get all roles (admin)
GET    /:roleId                   // Get single role (admin)
POST   /                          // Create role (admin)
PUT    /:roleId                   // Update role (admin)
DELETE /:roleId                   // Delete role (admin)
GET    /:roleId/users             // Get users by role (admin)
GET    /customer/users            // Get customers (admin)
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  

#### `requireAdmin`
**Purpose:** Admin access only  

---

## 📝 API Examples

### Get All Roles
```bash
curl -X GET http://localhost:4500/api/roles \
  -H "Authorization: Bearer <admin_access_token>"
```

### Create Custom Role (Admin)
```bash
curl -X POST http://localhost:4500/api/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "name": "support_agent",
    "displayName": "Support Agent",
    "description": "Role for customer support agents",
    "permissions": ["view_customers", "reply_tickets"],
    "isActive": true
  }'
```

### Get Users by Role
```bash
curl -X GET "http://localhost:4500/api/roles/<roleId>/users?page=1&limit=10" \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 🔒 Security Features

- **Role Management** - Only admin can create, update, or delete roles
- **System Role Protection** - System roles cannot be deleted
- **User Assignment Check** - Cannot delete role if users have it assigned

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Role not found" }
```

---

## 🔗 Integration with User System

Users have a `roles` array field that references Role documents:

```typescript
roles: [{
  type: Schema.Types.ObjectId,
  ref: 'Role'
}]
```

JWT tokens include roleIds in the payload:

```typescript
{
  userId: string,
  roleIds: string[],
  userType: "user"
}
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
