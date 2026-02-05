# 🧰 Appointment API - Service Management Documentation

## 📋 Table of Contents
- [Service Management Overview](#service-management-overview)
- [Service Model](#-service-model)
- [Service Controller](#-service-controller)
- [Service Routes](#-service-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Service Management Overview

Service Management covers the service catalog used in appointment booking. Each service includes pricing, duration, sort ordering, and an active flag for availability. Admins manage services, while read access is public for discovery and booking.

---

## 🧩 Service Model

### Schema Definition
```typescript
interface IService {
  _id: string;
  name: string;
  description?: string | null;
  duration: number; // minutes
  fullPrice: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Service.ts`**

```typescript
import mongoose, { Schema } from "mongoose";
import type { IService } from "../types/index";

const serviceSchema = new Schema<IService>(
  {
    name: {
      type: String,
      required: [true, "Service name is required"],
      unique: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    duration: {
      type: Number,
      required: [true, "Service duration is required"],
      min: [1, "Service duration must be at least 1 minute"]
    },
    fullPrice: {
      type: Number,
      required: [true, "Service full price is required"],
      min: [0, "Service full price cannot be negative"]
    },
    sortOrder: {
      type: Number,
      required: true,
      min: [0, "Sort order cannot be negative"],
      default: 0
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true
    }
  },
  { timestamps: true }
);

serviceSchema.index({ name: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ sortOrder: 1 });

const Service = mongoose.model<IService>("Service", serviceSchema);

export default Service;
```

### Validation Rules
```typescript
name:         { required: true, unique: true, maxlength: 120 }
description:  { optional, nullable, maxlength: 500 }
duration:     { required: true, min: 1 }
fullPrice:    { required: true, min: 0 }
sortOrder:    { default: 0, min: 0 }
isActive:     { default: true }
```

---

## 🎛️ Service Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Service from "../models/Service";
```

### Functions Overview

#### `createService()`
**Purpose:** Create a new service  
**Access:** Admin  
**Validation:**
- `name`, `duration`, `fullPrice` required
- Non-negative prices and sortOrder
**Process:** Validate + create service  
**Response:** Created service

**Controller Implementation:**
```typescript
export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, duration, fullPrice, sortOrder, isActive } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName || duration === undefined || fullPrice === undefined) {
      return next(errorHandler(400, "name, duration and fullPrice are required"));
    }

    if (!isPositiveNumber(duration)) {
      return next(errorHandler(400, "Duration must be a positive number"));
    }

    if (!isNonNegativeNumber(fullPrice)) {
      return next(errorHandler(400, "Full price must be zero or positive"));
    }

    if (sortOrder !== undefined && !isNonNegativeNumber(sortOrder)) {
      return next(errorHandler(400, "Sort order must be zero or positive"));
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return next(errorHandler(400, "isActive must be a boolean"));
    }

    const existingService = await Service.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") }
    });

    if (existingService) {
      return next(errorHandler(400, "Service with this name already exists"));
    }

    const service = new Service({
      name: trimmedName,
      description: typeof description === "string" ? description.trim() || null : null,
      duration,
      fullPrice,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true
    });

    await service.save();

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: { service }
    });
  } catch (error: any) {
    console.error("Create service error:", error);
    next(errorHandler(500, "Server error while creating service"));
  }
};
```

#### `getServices(query)`
**Purpose:** List services  
**Access:** Public  
**Validation:** Optional filters only  
**Process:** Filter by `status` and `search`, optional sort by `sort`  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Response:** Service list with pagination

**Controller Implementation:**
```typescript
export const getServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status, sort, page = 1, limit = 10 } = req.query;
    const query: any = {};

    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    let sortOptions: Record<string, 1 | -1> = { sortOrder: 1, name: 1 };

    if (typeof sort === "string" && sort.length > 0) {
      const [field, order] = sort.split(":");
      if (field === "sortOrder" && (order === "asc" || order === "desc")) {
        sortOptions = { sortOrder: order === "asc" ? 1 : -1, name: 1 };
      }
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query services with pagination
    const services = await Service.find(query)
      .sort(sortOptions)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await Service.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        services,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalServices: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get services error:", error);
    next(errorHandler(500, "Server error while fetching services"));
  }
};
```

#### `getService(serviceId)`
**Purpose:** Fetch a service by id  
**Access:** Public  
**Validation:** Service must exist  
**Process:** Find by id  
**Response:** Service record

**Controller Implementation:**
```typescript
export const getService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const service = await Service.findById(serviceId);

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    res.status(200).json({
      success: true,
      data: { service }
    });
  } catch (error: any) {
    console.error("Get service error:", error);
    next(errorHandler(500, "Server error while fetching service"));
  }
};
```

#### `updateService(serviceId, updates)`
**Purpose:** Update service details  
**Access:** Admin  
**Validation:** Valid fields only, name must be unique  
**Process:** Apply updates and save  
**Response:** Updated service

**Controller Implementation:**
```typescript
export const updateService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { name, description, duration, fullPrice, sortOrder, isActive } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return next(errorHandler(400, "Name must be a non-empty string"));
      }
 
      const trimmedName = name.trim();
      const existingService = await Service.findOne({
        _id: { $ne: serviceId },
        name: { $regex: new RegExp(`^${trimmedName}$`, "i") }
      });
      if (existingService) {
        return next(errorHandler(400, "Service with this name already exists"));
      }
      service.name = trimmedName;
    }

    if (description !== undefined) {
      if (description === null) {
        service.description = null;
      } else if (typeof description === "string") {
        const trimmedDescription = description.trim();
        service.description = trimmedDescription.length > 0 ? trimmedDescription : null;
      } else {
        return next(errorHandler(400, "Description must be a string"));
      }
    }

    if (duration !== undefined) {
      if (!isPositiveNumber(duration)) {
        return next(errorHandler(400, "Duration must be a positive number"));
      }
      service.duration = duration;
    }

    if (fullPrice !== undefined) {
      if (!isNonNegativeNumber(fullPrice)) {
        return next(errorHandler(400, "Full price must be zero or positive"));
      }
      service.fullPrice = fullPrice;
    }

    if (sortOrder !== undefined) {
      if (!isNonNegativeNumber(sortOrder)) {
        return next(errorHandler(400, "Sort order must be zero or positive"));
      }
      service.sortOrder = sortOrder;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return next(errorHandler(400, "isActive must be a boolean"));
      }
      service.isActive = isActive;
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: { service }
    });
  } catch (error: any) {
    console.error("Update service error:", error);
    next(errorHandler(500, "Server error while updating service"));
  }
};
```

#### `deleteService(serviceId)`
**Purpose:** Delete a service  
**Access:** Admin  
**Validation:** Service must exist  
**Process:** Delete by id  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const service = await Service.findById(serviceId);

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    await Service.findByIdAndDelete(serviceId);

    res.status(200).json({
      success: true,
      message: "Service deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete service error:", error);
    next(errorHandler(500, "Server error while deleting service"));
  }
};
```

#### `toggleServiceStatus(serviceId)`
**Purpose:** Activate or deactivate a service  
**Access:** Admin  
**Validation:** Service must exist  
**Process:** Toggle `isActive` or set it explicitly  
**Response:** Updated service

**Controller Implementation:**
```typescript
export const toggleServiceStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { isActive } = req.body;
    const service = await Service.findById(serviceId);

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return next(errorHandler(400, "isActive must be a boolean"));
      }
      service.isActive = isActive;
    } else {
      service.isActive = !service.isActive;
    }
    await service.save();

    res.status(200).json({
      success: true,
      message: "Service status updated successfully",
      data: { service }
    });
  } catch (error: any) {
    console.error("Toggle service status error:", error);
    next(errorHandler(500, "Server error while updating service status"));
  }
};
```

#### `assignServicesToStaff(userId)`
**Purpose:** Assign multiple services to a staff user  
**Access:** Admin  
**Validation:**
- `serviceIds` must be a non-empty array
- User must exist and have `staff` role
- All services must exist
**Process:** Replace `user.services` with provided list  
**Response:** Updated user services

**Controller Implementation:**
```typescript
export const assignServicesToStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { serviceIds } = req.body;

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return next(errorHandler(400, "serviceIds must be a non-empty array"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const staffRole = await Role.findOne({ name: "staff" }).select("_id");
    if (!staffRole) {
      return next(errorHandler(404, "Staff role not found. Please run seed script first."));
    }

    const roleIds = (user.roles || []).map((role: any) =>
      role?._id ? role._id.toString() : role.toString()
    );

    if (!roleIds.includes(staffRole._id.toString())) {
      return next(errorHandler(400, "User is not a staff member"));
    }

    const services = await Service.find({ _id: { $in: serviceIds } }).select("_id");
    if (services.length !== serviceIds.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    user.services = serviceIds as any;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Services assigned to staff successfully",
      data: {
        user: {
          id: user._id,
          services: user.services
        }
      }
    });
  } catch (error: any) {
    console.error("Assign services to staff error:", error);
    next(errorHandler(500, "Server error while assigning services to staff"));
  }
};
```

---

## 🛣️ Service Routes

### Base Path: `/api/services`

```typescript
GET    /                         // List services
GET    /:serviceId               // Get service by id
POST   /                         // Create service (admin)
PUT    /:serviceId               // Update service (admin)
DELETE /:serviceId               // Delete service (admin)
PATCH  /:serviceId/toggle-status // Activate/deactivate (admin)
POST   /assign/:userId           // Assign services to staff (admin)
```

### Router Implementation

**File: `src/routes/serviceRoutes.ts`**

```typescript
import express from "express";
import {
  createService,
  getServices,
  getService,
  updateService,
  deleteService,
  toggleServiceStatus,
  assignServicesToStaff
} from "../controllers/serviceController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

router.get("/", getServices);
router.get("/:serviceId", getService);
router.post("/", authenticateToken, requireAdmin, createService);
router.put("/:serviceId", authenticateToken, requireAdmin, updateService);
router.delete("/:serviceId", authenticateToken, requireAdmin, deleteService);
router.patch("/:serviceId/toggle-status", authenticateToken, requireAdmin, toggleServiceStatus);
router.post("/assign/:userId", authenticateToken, requireAdmin, assignServicesToStaff);

export default router;
```

### Route Details

#### `GET /api/services`
**Query (optional):** `sort=sortOrder:asc|desc`, `page`, `limit`, `status`, `search`  
**Response:**
```json
{
  "success": true,
  "data": {
    "services": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalServices": 0,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/services/:serviceId`
**Response:**
```json
{
  "success": true,
  "data": {
    "service": {
      "id": "...",
      "name": "Haircut"
    }
  }
}
```

#### `POST /api/services`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "name": "Haircut",
  "description": "Classic men haircut",
  "duration": 30,
  "fullPrice": 500,
  "sortOrder": 1
}
```
**Response:**
```json
{
  "success": true,
  "message": "Service created successfully",
  "data": {
    "service": {
      "id": "...",
      "name": "Haircut"
    }
  }
}
```

#### `PUT /api/services/:serviceId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "fullPrice": 600,
  "duration": 35,
  "sortOrder": 2
}
```
**Response:**
```json
{
  "success": true,
  "message": "Service updated successfully"
}
```

#### `DELETE /api/services/:serviceId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:**
```json
{
  "success": true,
  "message": "Service deleted successfully"
}
```

#### `PATCH /api/services/:serviceId/toggle-status`
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
  "message": "Service status updated successfully"
}
```

#### `POST /api/services/assign/:userId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "serviceIds": ["serviceId1", "serviceId2"]
}
```
**Response:**
```json
{
  "success": true,
  "message": "Services assigned to staff successfully",
  "data": {
    "user": {
      "id": "...",
      "services": ["serviceId1", "serviceId2"]
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token for protected routes  
**Usage:**
```typescript
router.post("/", authenticateToken, requireAdmin, createService);
```

#### `requireAdmin`
**Purpose:** Admin-only operations  
**Usage:**
```typescript
router.put("/:serviceId", authenticateToken, requireAdmin, updateService);
```

---

## 📝 API Examples

### List Services
```bash
curl -X GET "http://localhost:4500/api/services?sort=sortOrder:asc"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "services": []
  }
}
```

### Create Service
```bash
curl -X POST http://localhost:4500/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "name": "Haircut",
    "description": "Classic men haircut",
    "duration": 30,
    "fullPrice": 500,
    "sortOrder": 1
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Service created successfully",
  "data": {
    "service": {
      "id": "...",
      "name": "Haircut",
      "duration": 30,
      "fullPrice": 500
    }
  }
}
```

### Get Service By ID
```bash
curl -X GET http://localhost:4500/api/services/<serviceId>
```
**Response:**
```json
{
  "success": true,
  "data": {
    "service": {
      "id": "...",
      "name": "Haircut"
    }
  }
}
```

### Update Service
```bash
curl -X PUT http://localhost:4500/api/services/<serviceId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "fullPrice": 600,
    "duration": 35
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Service updated successfully"
}
```

### Delete Service
```bash
curl -X DELETE http://localhost:4500/api/services/<serviceId> \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Service deleted successfully"
}
```

### Toggle Service Status
```bash
curl -X PATCH http://localhost:4500/api/services/<serviceId>/toggle-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "isActive": false
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Service status updated successfully"
}
```

### Assign Services to Staff
```bash
curl -X POST http://localhost:4500/api/services/assign/<userId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "serviceIds": ["serviceId1", "serviceId2"]
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Services assigned to staff successfully",
  "data": {
    "user": {
      "id": "...",
      "services": ["serviceId1", "serviceId2"]
    }
  }
}
```

---

## 🛡️ Security Features

- **RBAC:** Admin-only for create/update/delete/status changes.
- **Public Access:** Read endpoints are public for service discovery.
- **Validation:** Strong validation on numeric fields and unique names.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Service not found" }
```

```json
{ "success": false, "message": "Service with this name already exists" }
```

---

## 📊 Database Indexes

```typescript
serviceSchema.index({ name: 1 });
serviceSchema.index({ isActive: 1 });
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
