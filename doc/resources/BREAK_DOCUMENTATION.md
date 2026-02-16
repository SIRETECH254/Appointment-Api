# ☕ Appointment API - Break Management Documentation

## 📋 Table of Contents
- [Break Overview](#break-overview)
- [Break Model](#-break-model)
- [Break Controller](#-break-controller)
- [Break Routes](#-break-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Break Overview

Breaks represent time ranges when a staff member is not available for appointments.  
Breaks are stored in the database and are used by availability to remove slots.

Integration with Availability:
- Breaks are pulled during slot calculation.
- Any slot overlapping a break is removed from availability.

---

## 🧩 Break Model

### Schema Definition
```typescript
interface IBreak {
  _id: ObjectId;
  staffId: ObjectId;
  startTime: Date;
  endTime: Date;
  reason?: string;
  createdAt: Date;
}
```

### Model Implementation

**File:** `src/models/Break.ts`

```typescript
import mongoose, { Schema } from "mongoose";
import type { IBreak } from "../types/index";

const breakSchema = new Schema<IBreak>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 300 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

breakSchema.index({ staffId: 1, startTime: 1, endTime: 1 });

const Break = mongoose.model<IBreak>("Break", breakSchema);
export default Break;
```

### Validation Rules
```typescript
staffId:   { required: true }
startTime: { required: true }
endTime:   { required: true }
reason:    { optional, maxlength: 300 }
```

---

## 🎮 Break Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import BreakModel from "../models/Break";
import User from "../models/User";
```

### Functions Overview

#### `createBreak()`
**Purpose:** Create a break for a staff member  
**Access:** Admin  
**Validation:** `staffId`, `startTime`, `endTime` required, `startTime < endTime`  
**Response:** Created break

**Controller Implementation:**
```typescript
export const createBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, startTime, endTime, reason } = req.body;

    if (!staffId || !startTime || !endTime) {
      return next(errorHandler(400, "staffId, startTime and endTime are required"));
    }

    const staff = await User.findById(staffId).select("_id");
    if (!staff) {
      return next(errorHandler(404, "Staff not found"));
    }

    const newBreak = new BreakModel({
      staffId,
      startTime,
      endTime,
      reason: typeof reason === "string" ? reason.trim() : undefined
    });

    await newBreak.save();

    res.status(201).json({
      success: true,
      message: "Break created successfully",
      data: { break: newBreak }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while creating break"));
  }
};
```

#### `getBreaks()`
**Purpose:** List breaks (optional filters)  
**Access:** Admin  
**Query:** `staffId`, `date`, `from`, `to`, `page`, `limit`  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Response:** Break list with populated staff information and pagination

**Controller Implementation:**
```typescript
export const getBreaks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, date, from, to, page = 1, limit = 10 } = req.query;
    const query: any = {};

    if (staffId) {
      const staffIdStr = String(staffId);
      if (!isValidObjectId(staffIdStr)) {
        return next(errorHandler(400, "Invalid staffId"));
      }
      query.staffId = staffIdStr;
    }

    if (date) {
      const dateOnly = parseDateOnly(String(date));
      if (!dateOnly) {
        return next(errorHandler(400, "Invalid date format. Use YYYY-MM-DD"));
      }
      const { start, end } = buildDayRange(dateOnly);
      query.startTime = { $lt: end };
      query.endTime = { $gt: start };
    } else if (from || to) {
      const fromDate = from ? parseDate(String(from)) : null;
      const toDate = to ? parseDate(String(to)) : null;
      if ((from && !fromDate) || (to && !toDate)) {
        return next(errorHandler(400, "Invalid from or to date"));
      }
      if (fromDate && toDate) {
        query.startTime = { $lt: toDate };
        query.endTime = { $gt: fromDate };
      } else if (fromDate) {
        query.endTime = { $gt: fromDate };
      } else if (toDate) {
        query.startTime = { $lt: toDate };
      }
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query breaks with pagination and populate staff
    const breaks = await BreakModel.find(query)
      .populate("staffId", "firstName lastName email phone")
      .sort({ startTime: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await BreakModel.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        breaks,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalBreaks: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get breaks error:", error);
    next(errorHandler(500, "Server error while fetching breaks"));
  }
};
```

#### `getBreak()`
**Purpose:** Get a break by id  
**Access:** Admin  
**Response:** Break record

**Controller Implementation:**
```typescript
export const getBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { breakId } = req.params;
    const existing = await BreakModel.findById(breakId);

    if (!existing) {
      return next(errorHandler(404, "Break not found"));
    }

    res.status(200).json({
      success: true,
      data: { break: existing }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching break"));
  }
};
```

#### `updateBreak()`
**Purpose:** Update break fields  
**Access:** Admin  
**Response:** Updated break

**Controller Implementation:**
```typescript
export const updateBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { breakId } = req.params;
    const { staffId, startTime, endTime, reason } = req.body;

    const existing = await BreakModel.findById(breakId);
    if (!existing) {
      return next(errorHandler(404, "Break not found"));
    }

    if (staffId) {
      const staff = await User.findById(staffId).select("_id");
      if (!staff) {
        return next(errorHandler(404, "Staff not found"));
      }
      existing.staffId = staff._id;
    }

    if (startTime) existing.startTime = new Date(startTime);
    if (endTime) existing.endTime = new Date(endTime);
    if (existing.startTime >= existing.endTime) {
      return next(errorHandler(400, "startTime must be earlier than endTime"));
    }

    if (reason !== undefined) {
      existing.reason = typeof reason === "string" ? reason.trim() : undefined;
    }

    await existing.save();

    res.status(200).json({
      success: true,
      message: "Break updated successfully",
      data: { break: existing }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating break"));
  }
};
```

#### `deleteBreak()`
**Purpose:** Delete a break  
**Access:** Admin  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { breakId } = req.params;
    const existing = await BreakModel.findById(breakId);

    if (!existing) {
      return next(errorHandler(404, "Break not found"));
    }

    await BreakModel.findByIdAndDelete(breakId);

    res.status(200).json({
      success: true,
      message: "Break deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while deleting break"));
  }
};
```

---

## 🛣️ Break Routes

### Base Path: `/api/breaks`

```typescript
GET    /            // List breaks (admin)
GET    /:breakId    // Get break (admin)
POST   /            // Create break (admin)
PUT    /:breakId    // Update break (admin)
DELETE /:breakId    // Delete break (admin)
```

### Router Implementation

**File:** `src/routes/breakRoutes.ts`

```typescript
import express from "express";
import {
  createBreak,
  getBreaks,
  getBreak,
  updateBreak,
  deleteBreak
} from "../controllers/breakController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

router.get("/", authenticateToken, requireAdmin, getBreaks);
router.get("/:breakId", authenticateToken, requireAdmin, getBreak);
router.post("/", authenticateToken, requireAdmin, createBreak);
router.put("/:breakId", authenticateToken, requireAdmin, updateBreak);
router.delete("/:breakId", authenticateToken, requireAdmin, deleteBreak);

export default router;
```

### Route Details

#### `GET /api/breaks`
**Headers:** `Authorization: Bearer <admin_token>`  
**Query (optional):** `staffId`, `date`, `from`, `to`, `page`, `limit`  
**Response:**
```json
{
  "success": true,
  "data": {
    "breaks": [
      {
        "id": "...",
        "staffId": {
          "id": "...",
          "firstName": "John",
          "lastName": "Staff",
          "email": "john@example.com",
          "phone": "+254712345679"
        },
        "startTime": "2026-01-25T12:00:00.000Z",
        "endTime": "2026-01-25T13:00:00.000Z",
        "reason": "Lunch break"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalBreaks": 0,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```
**Note:** The `staffId` field is populated with full staff details (firstName, lastName, email, phone).

#### `GET /api/breaks/:breakId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:**
```json
{
  "success": true,
  "data": {
    "break": {
      "_id": "...",
      "staffId": "...",
      "startTime": "2026-01-23T12:00:00.000Z",
      "endTime": "2026-01-23T12:30:00.000Z"
    }
  }
}
```

#### `POST /api/breaks`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "staffId": "<staffId>",
  "startTime": "2026-01-23T12:00:00.000Z",
  "endTime": "2026-01-23T12:30:00.000Z",
  "reason": "Lunch"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Break created successfully",
  "data": {
    "break": {
      "_id": "...",
      "staffId": "...",
      "startTime": "2026-01-23T12:00:00.000Z",
      "endTime": "2026-01-23T12:30:00.000Z"
    }
  }
}
```

#### `PUT /api/breaks/:breakId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "startTime": "2026-01-23T13:00:00.000Z",
  "endTime": "2026-01-23T13:30:00.000Z",
  "reason": "Updated reason"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Break updated successfully"
}
```

#### `DELETE /api/breaks/:breakId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:**
```json
{
  "success": true,
  "message": "Break deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token for protected routes  
**Usage:**
```typescript
router.post("/", authenticateToken, requireAdmin, createBreak);
```

#### `requireAdmin`
**Purpose:** Admin-only operations  
**Usage:**
```typescript
router.delete("/:breakId", authenticateToken, requireAdmin, deleteBreak);
```

---

## 📝 API Examples

### Create Break
```bash
curl -X POST http://localhost:4500/api/breaks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "staffId": "<staffId>",
    "startTime": "2026-01-23T12:00:00.000Z",
    "endTime": "2026-01-23T12:30:00.000Z",
    "reason": "Lunch"
  }'
```

### List Breaks
```bash
curl -X GET "http://localhost:4500/api/breaks?staffId=<staffId>&date=2026-01-23" \
  -H "Authorization: Bearer <admin_token>"
```

---

## 🛡️ Security Features

- Admin-only access for all break management endpoints.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "staffId, startTime and endTime are required" }
```

```json
{ "success": false, "message": "startTime must be earlier than endTime" }
```

---

## 📊 Database Indexes

```typescript
breakSchema.index({ staffId: 1, startTime: 1, endTime: 1 });
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
