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

Breaks represent recurring daily time ranges when a staff member is not available for appointments.  
Breaks are stored as time-only strings (HH:MM format) and automatically apply to every day the staff has working hours.

Integration with Availability:
- Breaks are stored as time strings (e.g., "13:00" to "14:00")
- During availability calculation, breaks are converted to date-time ranges for the specific day being checked
- Any slot overlapping a break is removed from availability
- Breaks only apply on days when the staff has working hours

---

## 🧩 Break Model

### Schema Definition
```typescript
interface IBreak {
  _id: ObjectId;
  staffId: ObjectId;
  startTime: string; // HH:MM format (e.g., "13:00")
  endTime: string;   // HH:MM format (e.g., "14:00")
  reason?: string;
  createdAt: Date;
}
```

### Model Implementation

**File:** `src/models/Break.ts`

```typescript
import mongoose, { Schema } from "mongoose";
import type { IBreak } from "../types/index";

// Validation function for HH:MM format
const validateTimeFormat = (time: string): boolean => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

const breakSchema = new Schema<IBreak>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { 
      type: String, 
      required: true,
      validate: {
        validator: validateTimeFormat,
        message: "Start time must be in HH:MM format (00:00 to 23:59)"
      }
    },
    endTime: { 
      type: String, 
      required: true,
      validate: {
        validator: validateTimeFormat,
        message: "End time must be in HH:MM format (00:00 to 23:59)"
      }
    },
    reason: { type: String, trim: true, maxlength: 300 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Validate that startTime < endTime
breakSchema.pre("save", function (next) {
  if (this.startTime && this.endTime) {
    if (this.startTime >= this.endTime) {
      return next(new Error("startTime must be earlier than endTime"));
    }
  }
  next();
});

// Index on staffId only
breakSchema.index({ staffId: 1 });

const Break = mongoose.model<IBreak>("Break", breakSchema);
export default Break;
```

### Validation Rules
```typescript
staffId:   { required: true }
startTime: { required: true, format: HH:MM (00:00 to 23:59) }
endTime:   { required: true, format: HH:MM (00:00 to 23:59) }
reason:    { optional, maxlength: 300 }
```
**Note:** `startTime` must be earlier than `endTime` (string comparison).

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
**Purpose:** Create a recurring daily break for a staff member  
**Access:** Admin  
**Validation:** `staffId`, `startTime` (HH:MM format string), `endTime` (HH:MM format string) required. `startTime < endTime`. Break applies to all days when staff has working hours.  
**Response:** Created break

**Controller Implementation:**
```typescript
export const createBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, startTime, endTime, reason } = req.body;

    if (!staffId || !startTime || !endTime) {
      return next(errorHandler(400, "staffId, startTime and endTime are required"));
    }

    const staffIdStr = String(staffId);
    if (!isValidObjectId(staffIdStr)) {
      return next(errorHandler(400, "Invalid staffId"));
    }

    const startTimeStr = String(startTime).trim();
    const endTimeStr = String(endTime).trim();

    if (!validateTimeFormat(startTimeStr)) {
      return next(errorHandler(400, "Invalid startTime format. Use HH:MM format (e.g., 13:00)"));
    }

    if (!validateTimeFormat(endTimeStr)) {
      return next(errorHandler(400, "Invalid endTime format. Use HH:MM format (e.g., 14:00)"));
    }

    if (startTimeStr >= endTimeStr) {
      return next(errorHandler(400, "startTime must be earlier than endTime"));
    }

    const staff = await User.findById(staffIdStr).select("_id");
    if (!staff) {
      return next(errorHandler(404, "Staff not found"));
    }

    const newBreak = new BreakModel({
      staffId: staffIdStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      reason: typeof reason === "string" ? reason.trim() : undefined
    });

    await newBreak.save();

    res.status(201).json({
      success: true,
      message: "Break created successfully",
      data: { break: newBreak }
    });
  } catch (error: any) {
    console.error("Create break error:", error);
    if (error.message && error.message.includes("startTime must be earlier")) {
      return next(errorHandler(400, error.message));
    }
    next(errorHandler(500, "Server error while creating break"));
  }
};
```

#### `getBreaks()`
**Purpose:** List breaks (optional filters)  
**Access:** Admin  
**Query:** `staffId`, `page`, `limit`  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Response:** Break list with populated staff information and pagination

**Note:** Breaks are time-only and apply to all days, so date filtering is not available.

**Controller Implementation:**
```typescript
export const getBreaks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, page = 1, limit = 10 } = req.query;
    const query: any = {};

    if (staffId) {
      const staffIdStr = String(staffId);
      if (!isValidObjectId(staffIdStr)) {
        return next(errorHandler(400, "Invalid staffId"));
      }
      query.staffId = staffIdStr;
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
**Response:** Break record with populated staff information

**Controller Implementation:**
```typescript
export const getBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { breakId } = req.params;
    const existing = await BreakModel.findById(breakId)
      .populate("staffId", "firstName lastName email phone");

    if (!existing) {
      return next(errorHandler(404, "Break not found"));
    }

    res.status(200).json({
      success: true,
      data: { break: existing }
    });
  } catch (error: any) {
    console.error("Get break error:", error);
    next(errorHandler(500, "Server error while fetching break"));
  }
};
```

#### `updateBreak()`
**Purpose:** Update break fields  
**Access:** Admin  
**Validation:** `breakId` required. `staffId`, `startTime` (HH:MM format string), `endTime` (HH:MM format string) are optional update fields. `startTime < endTime`.  
**Response:** Updated break

**Controller Implementation:**
```typescript
export const updateBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const breakIdParam = req.params.breakId;
    const { staffId, startTime, endTime, reason } = req.body;

    if (!breakIdParam) {
      return next(errorHandler(400, "breakId is required"));
    }
    const breakId = String(breakIdParam);
    if (!isValidObjectId(breakId)) {
      return next(errorHandler(400, "Invalid breakId"));
    }

    const existing = await BreakModel.findById(breakId);
    if (!existing) {
      return next(errorHandler(404, "Break not found"));
    }

    if (staffId !== undefined) {
      const staffIdStr = String(staffId);
      if (!isValidObjectId(staffIdStr)) {
        return next(errorHandler(400, "Invalid staffId"));
      }
      const staff = await User.findById(staffIdStr).select("_id");
      if (!staff) {
        return next(errorHandler(404, "Staff not found"));
      }
      existing.staffId = staff._id;
    }

    if (startTime !== undefined) {
      const startTimeStr = String(startTime).trim();
      if (!validateTimeFormat(startTimeStr)) {
        return next(errorHandler(400, "Invalid startTime format. Use HH:MM format (e.g., 13:00)"));
      }
      existing.startTime = startTimeStr;
    }

    if (endTime !== undefined) {
      const endTimeStr = String(endTime).trim();
      if (!validateTimeFormat(endTimeStr)) {
        return next(errorHandler(400, "Invalid endTime format. Use HH:MM format (e.g., 14:00)"));
      }
      existing.endTime = endTimeStr;
    }

    // Validate startTime < endTime (using string comparison)
    if (existing.startTime >= existing.endTime) {
      return next(errorHandler(400, "startTime must be earlier than endTime"));
    }

    if (reason !== undefined) {
      if (reason === null || (typeof reason === "string" && reason.trim().length === 0)) {
        existing.set("reason", undefined);
      } else if (typeof reason === "string") {
        existing.reason = reason.trim();
      }
    }

    await existing.save();

    res.status(200).json({
      success: true,
      message: "Break updated successfully",
      data: { break: existing }
    });
  } catch (error: any) {
    console.error("Update break error:", error);
    if (error.message && error.message.includes("startTime must be earlier")) {
      return next(errorHandler(400, error.message));
    }
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
**Query (optional):** `staffId`, `page`, `limit`  
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
        "startTime": "13:00",
        "endTime": "14:00",
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
**Note:** The `staffId` field is populated with full staff details (firstName, lastName, email, phone). Breaks are stored as time strings and apply to all days.

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
      "startTime": "13:00",
      "endTime": "14:00"
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
  "startTime": "13:00",
  "endTime": "14:00",
  "reason": "Lunch"
}
```
**(Note: `startTime` and `endTime` must be in HH:MM format (e.g., "13:00", "14:00"). The break will apply to all days when the staff has working hours.)**
**Response:**
```json
{
  "success": true,
  "message": "Break created successfully",
  "data": {
    "break": {
      "_id": "...",
      "staffId": "...",
      "startTime": "13:00",
      "endTime": "14:00",
      "reason": "Lunch"
    }
  }
}
```

#### `PUT /api/breaks/:breakId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "startTime": "13:00",
  "endTime": "14:00",
  "reason": "Updated reason"
}
```
**(Note: `startTime` and `endTime` must be in HH:MM format. All fields are optional except `breakId` in the URL.)**
**Response:**
```json
{
  "success": true,
  "message": "Break updated successfully",
  "data": {
    "break": {
      "_id": "...",
      "staffId": "...",
      "startTime": "13:00",
      "endTime": "14:00",
      "reason": "Updated reason"
    }
  }
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
    "startTime": "13:00",
    "endTime": "14:00",
    "reason": "Lunch"
  }'
```

### List Breaks
```bash
curl -X GET "http://localhost:4500/api/breaks?staffId=<staffId>" \
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
breakSchema.index({ staffId: 1 });
```

**Note:** Only `staffId` is indexed since breaks are now time-only strings and don't require date-range queries.

---

**Last Updated:** January 2026  
**Version:** 1.0.0
