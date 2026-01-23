# 🎭 Appointment API - Role Management System Documentation

## 📋 Table of Contents
- [Role Overview](#role-overview)
- [Role Model](#role-model)
- [Role Controller](#role-controller)
- [Role Routes](#role-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Scripts](#scripts)
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
import mongoose, { Schema } from 'mongoose';
import type { IRole } from '../types/index';

const roleSchema = new Schema<IRole>({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: [50, 'Role name cannot exceed 50 characters']
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  permissions: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true },
  isSystemRole: { type: Boolean, default: false }
}, { timestamps: true });

roleSchema.index({ isActive: 1 });
roleSchema.index({ isSystemRole: 1 });

const Role = mongoose.model<IRole>('Role', roleSchema);
export default Role;
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
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Role from "../models/Role";
import User from "../models/User";
```

### Functions Overview

#### `getAllRoles(query)`
**Purpose:** List roles with optional filters  
**Access:** Admin  
**Validation:** Optional `isActive` and `search` filters  
**Process:**
- Build query filters for status/search
- Return sorted roles list
**Response:** Array of roles

**Controller Implementation:**
```typescript
export const getAllRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isActive, search } = req.query;
    const query: any = {};

    // Optional filters
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Search by name/display/description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const roles = await Role.find(query).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: { roles }
    });
  } catch (error: any) {
    console.error("Get all roles error:", error);
    next(errorHandler(500, "Server error while fetching roles"));
  }
};
```

#### `getRole(roleId)`
**Purpose:** Fetch a single role  
**Access:** Admin  
**Validation:** Role must exist  
**Process:** Fetch role by id  
**Response:** Role details

**Controller Implementation:**
```typescript
export const getRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const role = await Role.findById(roleId);

    // Ensure role exists
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    res.status(200).json({
      success: true,
      data: { role }
    });
  } catch (error: any) {
    console.error("Get role error:", error);
    next(errorHandler(500, "Server error while fetching role"));
  }
};
```

#### `createRole(roleData)`
**Purpose:** Create a new custom role  
**Access:** Admin  
**Validation:**
- Name and display name required
- Role name must be unique
**Process:** Create a non-system role with permissions  
**Response:** Newly created role

**Controller Implementation:**
```typescript
export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, displayName, description, permissions, isActive } = req.body;

    // Validate required fields
    if (!name || !displayName) {
      return next(errorHandler(400, "Name and display name are required"));
    }

    // Ensure role name is unique
    const existingRole = await Role.findOne({ name: name.toLowerCase() });
    if (existingRole) {
      return next(errorHandler(400, "Role with this name already exists"));
    }

    // Create a non-system role
    const role = new Role({
      name: name.toLowerCase(),
      displayName,
      description,
      permissions: permissions || [],
      isActive: isActive !== undefined ? isActive : true,
      isSystemRole: false
    });

    await role.save();

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: { role }
    });
  } catch (error: any) {
    console.error("Create role error:", error);
    next(errorHandler(500, "Server error while creating role"));
  }
};
```

#### `updateRole(roleId, updates)`
**Purpose:** Update role metadata or permissions  
**Access:** Admin  
**Validation:**
**Validation:**
- Role must exist
- System role names cannot be changed
**Process:** Apply updates and persist  
**Response:** Updated role

**Controller Implementation:**
```typescript
export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const { displayName, description, permissions, isActive } = req.body;

    const role = await Role.findById(roleId);
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    // Block renaming system roles
    if (role.isSystemRole && req.body.name && req.body.name !== role.name) {
      return next(errorHandler(400, "Cannot change system role name"));
    }

    if (displayName) role.displayName = displayName;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;
    if (isActive !== undefined) role.isActive = isActive;

    await role.save();

    res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: { role }
    });
  } catch (error: any) {
    console.error("Update role error:", error);
    next(errorHandler(500, "Server error while updating role"));
  }
};
```

#### `deleteRole(roleId)`
**Purpose:** Delete a non-system role  
**Access:** Admin  
**Validation:**
- Role must exist and not be system role
- No users should reference the role
**Process:** Delete role by id  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const role = await Role.findById(roleId);

    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    // Prevent deleting system roles
    if (role.isSystemRole) {
      return next(errorHandler(400, "Cannot delete system roles"));
    }

    // Ensure no users still reference this role
    const usersWithRole = await User.countDocuments({ roles: roleId });
    if (usersWithRole > 0) {
      return next(
        errorHandler(
          400,
          `Cannot delete role. ${usersWithRole} user(s) have this role assigned. Please reassign users first.`
        )
      );
    }

    await Role.findByIdAndDelete(roleId);

    res.status(200).json({
      success: true,
      message: "Role deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete role error:", error);
    next(errorHandler(500, "Server error while deleting role"));
  }
};
```

#### `getUsersByRole(roleId, query)`
**Purpose:** List users assigned to a role  
**Access:** Admin  
**Validation:** Role must exist  
**Process:** Filter users by role with pagination  
**Response:** Users + pagination

**Controller Implementation:**
```typescript
export const getUsersByRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const { page = 1, limit = 10, search, isActive } = req.query;

    const role = await Role.findById(roleId);
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    // Build query with filters
    const query: any = { roles: roleId };
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Fetch users and pagination stats
    const users = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        role: {
          id: role._id,
          name: role.name,
          displayName: role.displayName
        },
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
    console.error("Get users by role error:", error);
    next(errorHandler(500, "Server error while fetching users by role"));
  }
};
```

#### `getCustomers(query)`
**Purpose:** List users with customer role  
**Access:** Admin/Staff  
**Validation:**
- Customer role must exist
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

    // Build customer filter
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

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    const customers = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name displayName")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

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
    console.error("Get customers error:", error);
    next(errorHandler(500, "Server error while fetching customers"));
  }
};
```

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

### Router Implementation

**File: `src/routes/roleRoutes.ts`**

```typescript
import express from 'express';
import {
  getAllRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getUsersByRole,
  getCustomers
} from '../controllers/roleController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles(['admin']), getAllRoles);

router.get('/:roleId', authenticateToken, authorizeRoles(['admin']), getRole);

router.post('/', authenticateToken, requireAdmin, createRole);

router.put('/:roleId', authenticateToken, requireAdmin, updateRole);

router.delete('/:roleId', authenticateToken, requireAdmin, deleteRole);

router.get('/:roleId/users', authenticateToken, authorizeRoles(['admin']), getUsersByRole);

router.get('/customer/users', authenticateToken, authorizeRoles(['admin']), getCustomers);

export default router;
```

### Route Details

#### `GET /api/roles`
**Headers:** `Authorization: Bearer <admin_token>`
**Query:** `isActive`, `search`
**Response:**
```json
{
  "success": true,
  "data": {
    "roles": []
  }
}
```

#### `POST /api/roles`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "name": "support_agent",
  "displayName": "Support Agent",
  "description": "Role for support agents",
  "permissions": ["view_customers", "reply_tickets"],
  "isActive": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "role": {
      "_id": "...",
      "name": "support_agent",
      "displayName": "Support Agent"
    }
  }
}
```

#### `GET /api/roles/:roleId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "role": {
      "_id": "...",
      "name": "admin",
      "displayName": "Admin"
    }
  }
}
```

#### `PUT /api/roles/:roleId`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "displayName": "Updated Role Name",
  "description": "Updated description",
  "permissions": ["view_customers", "reply_tickets"],
  "isActive": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Role updated successfully",
  "data": {
    "role": {
      "_id": "...",
      "name": "support_agent",
      "displayName": "Updated Role Name"
    }
  }
}
```

#### `DELETE /api/roles/:roleId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

#### `GET /api/roles/:roleId/users`
**Headers:** `Authorization: Bearer <admin_token>`
**Query:** `page`, `limit`, `search`, `isActive`
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

#### `GET /api/roles/customer/users`
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

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.get('/roles', authenticateToken, authorizeRoles(['admin']), getAllRoles);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.get('/roles/:roleId', authenticateToken, authorizeRoles(['admin']), getRole);
```

#### `requireAdmin`
**Purpose:** Admin access only  
**Usage:**
```typescript
router.post('/roles', authenticateToken, requireAdmin, createRole);
```

---

## 📝 API Examples

### Get All Roles
```bash
curl -X GET http://localhost:4500/api/roles \
  -H "Authorization: Bearer <admin_access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "_id": "...",
        "name": "customer",
        "displayName": "Customer"
      }
    ]
  }
}
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
**Response:**
```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "role": {
      "_id": "...",
      "name": "support_agent",
      "displayName": "Support Agent"
    }
  }
}
```

### Get Users by Role
```bash
curl -X GET "http://localhost:4500/api/roles/<roleId>/users?page=1&limit=10" \
  -H "Authorization: Bearer <admin_access_token>"
```
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

---

## 📜 Scripts

### Seed Roles Script
**File:** `src/scripts/seedRoles.ts`  
**Purpose:** Upsert default system roles into the database  
**Command:**
```bash
npm run seed:roles
```
**Behavior:**
- Creates or updates the `customer`, `admin`, and `staff` roles
- Ensures roles remain active and system-protected

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
