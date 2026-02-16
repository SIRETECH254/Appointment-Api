# 🏪 Appointment API - Store Configuration Documentation

## 📋 Table of Contents
- [Store Configuration Overview](#store-configuration-overview)
- [Store Configuration Model](#store-configuration-model)
- [Store Configuration Controller](#store-configuration-controller)
- [Store Configuration Routes](#store-configuration-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Scripts](#scripts)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with User System](#integration-with-user-system)

---

## 🏪 Store Configuration Overview

The Appointment API uses a single store configuration document that defines business rules, pricing logic, and notification settings for the entire platform.

### Store Configuration Features
- **Single Document** - One configuration object for the whole system
- **Public Read** - GET is accessible without authentication
- **Admin Update Only** - Only admins can update values
- **No Deletion** - The configuration is never deleted
- **Upsert on Update** - If missing, it is created on update

---

## 🗄️ Store Configuration Model

### Schema Definition
```typescript
interface IStoreConfiguration extends Document {
  _id: ObjectId;
  appointmentFeeType: "FIXED" | "PERCENTAGE";
  appointmentFeeValue: number;
  currency: "KES";
  minBookingNotice: number; // minutes
  lateGracePeriod: number; // minutes
  allowWalkIns: boolean;
  notificationSettings: {
    sendSMS: boolean;
    sendEmail: boolean;
    sendPush: boolean;
    reminderTimes: number[]; // minutes before appointment
  };
  businessHoursTimezone: "Africa/Nairobi";
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/StoreConfiguration.ts`**

```typescript
import mongoose, { Schema } from "mongoose";
import type { IStoreConfiguration } from "../types/index";

const storeConfigurationSchema = new Schema<IStoreConfiguration>(
  {
    appointmentFeeType: {
      type: String,
      enum: ["FIXED", "PERCENTAGE"],
      required: [true, "Appointment fee type is required"],
      default: "FIXED"
    },
    appointmentFeeValue: {
      type: Number,
      required: [true, "Appointment fee value is required"],
      min: [0, "Appointment fee value cannot be negative"],
      default: 200
    },
    currency: {
      type: String,
      enum: ["KES"],
      required: [true, "Currency is required"],
      default: "KES"
    },
    minBookingNotice: {
      type: Number,
      required: [true, "Minimum booking notice is required"],
      min: [0, "Minimum booking notice cannot be negative"],
      default: 60
    },
    lateGracePeriod: {
      type: Number,
      required: [true, "Late grace period is required"],
      min: [0, "Late grace period cannot be negative"],
      default: 10
    },
    allowWalkIns: {
      type: Boolean,
      required: true,
      default: true
    },
    notificationSettings: {
      sendSMS: {
        type: Boolean,
        required: true,
        default: true
      },
      sendEmail: {
        type: Boolean,
        required: true,
        default: true
      },
      sendPush: {
        type: Boolean,
        required: true,
        default: false
      },
      reminderTimes: {
        type: [Number],
        default: [1440, 120, 30],
        validate: {
          validator: (values: number[]) => values.every((value) => value >= 0),
          message: "Reminder times must be zero or positive minutes"
        }
      }
    },
    businessHoursTimezone: {
      type: String,
      enum: ["Africa/Nairobi"],
      required: [true, "Business hours timezone is required"],
      default: "Africa/Nairobi"
    }
  },
  {
    timestamps: true
  }
);

const StoreConfiguration = mongoose.model<IStoreConfiguration>(
  "StoreConfiguration",
  storeConfigurationSchema
);

export default StoreConfiguration;
```

### Default Store Configuration
```typescript
{
  appointmentFeeType: "FIXED",
  appointmentFeeValue: 200,
  currency: "KES",
  minBookingNotice: 60,
  lateGracePeriod: 10,
  allowWalkIns: true,
  notificationSettings: {
    sendSMS: true,
    sendEmail: true,
    sendPush: false,
    reminderTimes: [1440, 120, 30]
  },
  businessHoursTimezone: "Africa/Nairobi"
}
```

---

## 🎮 Store Configuration Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import StoreConfiguration from "../models/StoreConfiguration";
```

### Functions Overview

#### `getStoreConfiguration()`
**Purpose:** Fetch the single configuration document  
**Access:** Public  
**Validation:** None  
**Process:**
- Fetch the latest stored configuration
- Create a default document if missing
**Response:** Store configuration

**Controller Implementation:**
```typescript
export const getStoreConfiguration = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let storeConfiguration = await StoreConfiguration.findOne().sort({ createdAt: -1 });

    if (!storeConfiguration) {
      storeConfiguration = new StoreConfiguration();
      await storeConfiguration.save();
    }

    res.status(200).json({
      success: true,
      data: { storeConfiguration }
    });
  } catch (error: any) {
    console.error("Get store configuration error:", error);
    next(errorHandler(500, "Server error while fetching store configuration"));
  }
};
```

#### `updateStoreConfiguration()`
**Purpose:** Update the single configuration document  
**Access:** Admin  
**Validation:**
- Notification settings must be an object
- Reminder times must be non-negative minutes
**Process:**
- Fetch or create the configuration document
- Apply provided updates
**Response:** Updated configuration

**Controller Implementation:**
```typescript
export const updateStoreConfiguration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      appointmentFeeType,
      appointmentFeeValue,
      currency,
      minBookingNotice,
      lateGracePeriod,
      allowWalkIns,
      notificationSettings,
      businessHoursTimezone
    } = req.body;

    if (notificationSettings !== undefined && typeof notificationSettings !== "object") {
      return next(errorHandler(400, "Notification settings must be an object"));
    }

    if (notificationSettings?.reminderTimes !== undefined) {
      const reminderError = validateReminderTimes(notificationSettings.reminderTimes);
      if (reminderError) {
        return next(errorHandler(400, reminderError));
      }
    }

    let storeConfiguration = await StoreConfiguration.findOne().sort({ createdAt: -1 });
    if (!storeConfiguration) {
      storeConfiguration = new StoreConfiguration();
    }

    if (appointmentFeeType !== undefined) storeConfiguration.appointmentFeeType = appointmentFeeType;
    if (appointmentFeeValue !== undefined) storeConfiguration.appointmentFeeValue = appointmentFeeValue;
    if (currency !== undefined) storeConfiguration.currency = currency;
    if (minBookingNotice !== undefined) storeConfiguration.minBookingNotice = minBookingNotice;
    if (lateGracePeriod !== undefined) storeConfiguration.lateGracePeriod = lateGracePeriod;
    if (allowWalkIns !== undefined) storeConfiguration.allowWalkIns = allowWalkIns;
    if (businessHoursTimezone !== undefined) {
      storeConfiguration.businessHoursTimezone = businessHoursTimezone;
    }

    if (notificationSettings !== undefined) {
      if (notificationSettings.sendSMS !== undefined) {
        storeConfiguration.notificationSettings.sendSMS = notificationSettings.sendSMS;
      }
      if (notificationSettings.sendEmail !== undefined) {
        storeConfiguration.notificationSettings.sendEmail = notificationSettings.sendEmail;
      }
      if (notificationSettings.sendPush !== undefined) {
        storeConfiguration.notificationSettings.sendPush = notificationSettings.sendPush;
      }
      if (notificationSettings.reminderTimes !== undefined) {
        storeConfiguration.notificationSettings.reminderTimes = notificationSettings.reminderTimes;
      }
    }

    await storeConfiguration.save();

    res.status(200).json({
      success: true,
      message: "Store configuration updated successfully",
      data: { storeConfiguration }
    });
  } catch (error: any) {
    console.error("Update store configuration error:", error);
    next(errorHandler(500, "Server error while updating store configuration"));
  }
};
```

---

## 🛣️ Store Configuration Routes

### Base Path: `/api/store-configuration`

```typescript
GET    /                          // Get store configuration (public)
PUT    /                          // Update store configuration (admin)
```

### Router Implementation

**File: `src/routes/storeConfigurationRoutes.ts`**

```typescript
import express from "express";
import {
  getStoreConfiguration,
  updateStoreConfiguration
} from "../controllers/storeConfigurationController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

router.get("/", getStoreConfiguration);
router.put("/", authenticateToken, requireAdmin, updateStoreConfiguration);

export default router;
```

### Route Details

#### `GET /api/store-configuration`
**Headers:** None  
**Response:**
```json
{
  "success": true,
  "data": {
    "storeConfiguration": {}
  }
}
```

#### `PUT /api/store-configuration`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "appointmentFeeType": "FIXED",
  "appointmentFeeValue": 200,
  "currency": "KES",
  "minBookingNotice": 60,
  "lateGracePeriod": 10,
  "allowWalkIns": true,
  "notificationSettings": {
    "sendSMS": true,
    "sendEmail": true,
    "sendPush": false,
    "reminderTimes": [1440, 120, 30]
  },
  "businessHoursTimezone": "Africa/Nairobi"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Store configuration updated successfully",
  "data": {
    "storeConfiguration": {
      "_id": "...",
      "appointmentFeeType": "FIXED"
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user  
**Usage:**
```typescript
router.put("/store-configuration", authenticateToken, requireAdmin, updateStoreConfiguration);
```

#### `requireAdmin`
**Purpose:** Admin access only  
**Usage:**
```typescript
router.put("/store-configuration", authenticateToken, requireAdmin, updateStoreConfiguration);
```

---

## 📝 API Examples

### Get Store Configuration
```bash
curl -X GET http://localhost:4500/api/store-configuration
```
**Response:**
```json
{
  "success": true,
  "data": {
    "storeConfiguration": {
      "appointmentFeeType": "FIXED",
      "appointmentFeeValue": 200,
      "currency": "KES",
      "minBookingNotice": 60,
      "lateGracePeriod": 10,
      "allowWalkIns": true,
      "notificationSettings": {
        "sendSMS": true,
        "sendEmail": true,
        "sendPush": false,
        "reminderTimes": [1440, 120, 30]
      },
      "businessHoursTimezone": "Africa/Nairobi"
    }
  }
}
```

### Update Store Configuration (Admin)
```bash
curl -X PUT http://localhost:4500/api/store-configuration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "appointmentFeeType": "PERCENTAGE",
    "appointmentFeeValue": 15,
    "currency": "KES",
    "minBookingNotice": 120,
    "lateGracePeriod": 15,
    "allowWalkIns": false,
    "notificationSettings": {
      "sendSMS": true,
      "sendEmail": true,
      "sendPush": true,
      "reminderTimes": [1440, 60, 15]
    },
    "businessHoursTimezone": "Africa/Nairobi"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Store configuration updated successfully",
  "data": {
    "storeConfiguration": {
      "appointmentFeeType": "PERCENTAGE",
      "appointmentFeeValue": 15,
      "currency": "KES"
    }
  }
}
```

---

## 📜 Scripts

### Seed Store Configuration Script
**File:** `src/scripts/seedStoreConfiguration.ts`  
**Purpose:** Upsert the single store configuration document  
**Command:**
```bash
npm run seed:store-configuration
```
**Behavior:**
- Creates the configuration if missing
- Updates fields to the default values when run

---

## 🔒 Security Features

- **Public Read Access** - GET is available without authentication
- **Admin Update Only** - PUT requires admin role
- **Single Document** - No create/delete endpoints exposed

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Validation error" }
```

---

## 🔗 Integration with User System

Store configuration values are used across user and appointment flows:

```typescript
{
  appointmentFeeType: "FIXED" | "PERCENTAGE",
  appointmentFeeValue: number,
  minBookingNotice: number,
  allowWalkIns: boolean
}
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
