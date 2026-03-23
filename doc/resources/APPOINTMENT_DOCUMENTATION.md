# 📅 Appointment Management Documentation

## 📋 Table of Contents
- [Appointment Overview](#appointment-overview)
- [Appointment Model](#-appointment-model)
- [Appointment Controller](#-appointment-controller)
- [Appointment Routes](#-appointment-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Appointment Overview

Appointments represent a booked service for a customer with a staff member at a specific time. Appointments can include **multiple services**, and the **booking fee** is derived from store configuration. The **remaining amount** is computed server-side from the full service total minus the booking fee (never accepted from `req.body`).

Statuses flow through: **PENDING → CONFIRMED → COMPLETED**, with **CANCELLED** and **NO_SHOW** as terminal states.

---

## 🧾 Appointment Model

### Schema Definition
```typescript
interface IAppointment {
  _id: ObjectId;
  customerId: ObjectId;
  staffId: ObjectId;
  services: ObjectId[];
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
```

### Model Implementation

**File: `src/models/Appointment.ts`**

```typescript
import mongoose, { Schema } from "mongoose";
import type { IAppointment } from "../types/index";

const appointmentSchema = new Schema<IAppointment>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    services: [{ type: Schema.Types.ObjectId, ref: "Service", required: true }],
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
      default: "PENDING",
      required: true
    },
    bookingFeeAmount: { type: Number, min: 0, default: 0, required: true },
    remainingAmount: { type: Number, min: 0, default: 0, required: true },
    checkedInAt: { type: Date },
    actualEndTime: { type: Date }
  },
  { timestamps: true }
);
```

### Amount Rules
- **bookingFeeAmount** is computed from Store Configuration (`appointmentFeeType`, `appointmentFeeValue`).
- **remainingAmount** is computed as `totalServiceAmount - bookingFeeAmount`.
- `remainingAmount` must **never** be provided by the client.

### Validation Rules
```typescript
customerId: { required: true, ref: "User" }
staffId:    { required: true, ref: "User" }
services:   { required: true, ref: "Service", minItems: 1 }
startTime:  { required: true, Date }
endTime:    { required: true, Date, endTime > startTime }
status:     { enum: ["PENDING","CONFIRMED","COMPLETED","CANCELLED","NO_SHOW"] }
bookingFeeAmount: { computed, min: 0 }
remainingAmount:  { computed, min: 0 }
```

---

## 🎮 Appointment Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import Appointment from "../models/Appointment";
import Service from "../models/Service";
import StoreConfiguration from "../models/StoreConfiguration";
import { createInAppNotification } from "../utils/notificationHelper";
import { checkSlotAvailability } from "../utils/availability";
import { errorHandler } from "../middleware/errorHandler";
```

### Functions Overview

#### `createAppointment()`
**Purpose:** Create a new appointment in PENDING status  
**Access:** Customer (or admin)  
**Validation:**
- Customer is derived from the authenticated user
- Staff and services must exist
- `startTime`/`endTime` must be valid and available
**Process:**
- Check slot availability for staff (working hours, breaks, existing appointments)
- Overlapping appointments only block the slot if status is `CONFIRMED` or `COMPLETED`
- Load services and compute total service amount
- Fetch store configuration and calculate booking fee
- Compute `remainingAmount` server-side
- Save appointment with status `PENDING`  
 - Send in-app notification to customer with action to confirm appointment
**Response:** Appointment summary

**Controller Implementation:**
```typescript
export const createAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, services, startTime, endTime } = req.body;
    const customerId = req.user?._id;

    if (!customerId || !staffId || !Array.isArray(services) || services.length === 0) {
      return next(errorHandler(400, "staffId and services are required"));
    }

    if (!startTime || !endTime) {
      return next(errorHandler(400, "startTime and endTime are required"));
    }

    const now = new Date();
    if (new Date(startTime) <= now) {
      return next(errorHandler(400, "Appointment time has passed"));
    }

    const serviceDocs = await Service.find({ _id: { $in: services }, isActive: true });
    if (serviceDocs.length !== services.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    const slotCheck = await checkSlotAvailability({
      staffId: String(staffId),
      serviceIds: services.map((id: any) => id.toString()),
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });
    if (!slotCheck.ok) {
      return next(errorHandler(400, slotCheck.message || "Appointment time is not available"));
    }

    const totalAmount = serviceDocs.reduce((sum, service) => sum + (service.fullPrice || 0), 0);
    const config = await StoreConfiguration.findOne();
    if (!config) {
      return next(errorHandler(500, "Store configuration not found"));
    }

    const bookingFeeAmount = calculateBookingFee(totalAmount, config.appointmentFeeType, config.appointmentFeeValue);
    const remainingAmount = Math.max(0, totalAmount - bookingFeeAmount);

    const appointment = await Appointment.create({
      customerId,
      staffId,
      services,
      startTime,
      endTime,
      bookingFeeAmount,
      remainingAmount,
      status: "PENDING"
    });

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("customerId", "firstName lastName email phone")
      .populate("staffId", "firstName lastName email phone")
      .populate("services", "name duration fullPrice");

    try {
      await createInAppNotification({
        recipient: String(customerId),
        recipientModel: "User",
        category: "appointment",
        subject: "Appointment booked",
        message: "Your appointment was booked successfully. Please confirm by paying the booking fee.",
        actions: [
          {
            id: "confirm_appointment",
            label: "Confirm Appointment",
            type: "api",
            endpoint: `/api/appointments/${appointment._id}/confirm`,
            method: "POST",
            variant: "primary"
          }
        ],
        context: {
          resourceId: appointment._id.toString(),
          resourceType: "appointment"
        },
        metadata: {
          appointmentId: appointment._id.toString()
        },
        io: req.app.get("io")
      });
    } catch (notificationError) {
      console.error("In-app notification error:", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Appointment created",
      data: { appointment: populatedAppointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while creating appointment"));
  }
};
```

#### `createAppointmentAdmin()`
**Purpose:** Create a new appointment for a specific user  
**Access:** Admin/Staff  
**Validation:**
- `userId` must be provided in the request body
- Staff and services must exist
- `startTime`/`endTime` must be valid and available
**Process:**
- Validate required fields including `userId`
- Check slot availability for staff
- Load services and compute total service amount
- Fetch store configuration and calculate fees
- Save appointment with status `PENDING`
- Send in-app notification to the customer (specified by `userId`)
**Response:** Appointment summary

**Controller Implementation:**
```typescript
export const createAppointmentAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, staffId, services, startTime, endTime } = req.body;

    if (!userId || !staffId || !Array.isArray(services) || services.length === 0) {
      return next(errorHandler(400, "userId, staffId and services are required"));
    }

    if (!startTime || !endTime) {
      return next(errorHandler(400, "startTime and endTime are required"));
    }

    const now = new Date();
    if (new Date(startTime) <= now) {
      return next(errorHandler(400, "Appointment time has passed"));
    }

    const serviceDocs = await Service.find({ _id: { $in: services }, isActive: true });
    if (serviceDocs.length !== services.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    const slotCheck = await checkSlotAvailability({
      staffId: String(staffId),
      serviceIds: services.map((id: any) => id.toString()),
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });
    if (!slotCheck.ok) {
      return next(errorHandler(400, slotCheck.message || "Appointment time is not available"));
    }

    const totalAmount = serviceDocs.reduce((sum, service) => sum + (service.fullPrice || 0), 0);
    const config = await StoreConfiguration.findOne();
    if (!config) {
      return next(errorHandler(500, "Store configuration not found"));
    }

    const bookingFeeAmount = calculateBookingFee(totalAmount, config.appointmentFeeType, config.appointmentFeeValue);
    const remainingAmount = Math.max(0, totalAmount - bookingFeeAmount);

    const appointment = await Appointment.create({
      customerId: userId,
      staffId,
      services,
      startTime,
      endTime,
      bookingFeeAmount,
      remainingAmount,
      status: "PENDING"
    });

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("customerId", "firstName lastName email phone")
      .populate("staffId", "firstName lastName email phone")
      .populate("services", "name duration fullPrice");

    try {
      await createInAppNotification({
        recipient: String(userId),
        recipientModel: "User",
        category: "appointment",
        subject: "Appointment booked",
        message: "An appointment has been booked for you by an admin. Please confirm by paying the booking fee.",
        actions: [
          {
            id: "confirm_appointment",
            label: "Confirm Appointment",
            type: "api",
            endpoint: `/api/appointments/${appointment._id}/confirm`,
            method: "POST",
            variant: "primary"
          }
        ],
        context: {
          resourceId: appointment._id.toString(),
          resourceType: "appointment"
        },
        metadata: {
          appointmentId: appointment._id.toString()
        },
        io: req.app.get("io")
      });
    } catch (notificationError) {
      console.error("In-app notification error:", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Appointment created successfully by admin",
      data: { appointment: populatedAppointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while creating appointment (admin)"));
  }
};
```

#### `confirmAppointment()`
**Purpose:** Initiate booking fee payment and confirm after payment success  
**Access:** Customer/Admin  
**Validation:**
- Appointment must exist and not be completed/cancelled/no-show
- Appointment time must not be in the past
- Staff must provide the requested services
- Appointment time must be within staff working hours and not overlapping breaks
- Overlapping appointments only block the slot if status is `CONFIRMED` or `COMPLETED`
- `phone` required for MPESA, `email` required for CARD
**Process:**
- Validate appointment slot against staff availability (working hours, breaks, existing appointments)
- Initiate booking fee payment (M-Pesa or Paystack)
- Appointment is confirmed only after payment webhook success  
**Response:** Payment initiation details + appointment

**Controller Implementation:**
```typescript
export const confirmAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const { method, phone, email } = req.body;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status === "CANCELLED" || appointment.status === "NO_SHOW" || appointment.status === "COMPLETED") {
      return next(errorHandler(400, "Appointment cannot be confirmed"));
    }

    const now = new Date();
    if (appointment.startTime <= now) {
      return next(errorHandler(400, "Appointment time has passed"));
    }

    const slotCheck = await checkSlotAvailability({
      staffId: appointment.staffId.toString(),
      serviceIds: (appointment.services || []).map((id) => id.toString()),
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      excludeAppointmentId: appointment._id.toString()
    });
    if (!slotCheck.ok) {
      return next(errorHandler(400, slotCheck.message || "Appointment time is not available"));
    }

    const allowedMethods = ["MPESA", "CARD"];
    if (!allowedMethods.includes(method)) {
      return next(errorHandler(400, "Invalid payment method for confirmation"));
    }

    if (method === "MPESA" && !phone) {
      return next(errorHandler(400, "phone is required for MPESA payments"));
    }
    if (method === "CARD" && !email) {
      return next(errorHandler(400, "email is required for CARD payments"));
    }

    const bookingFeeAmount = appointment.bookingFeeAmount;
    if (!validatePaymentAmount(bookingFeeAmount, appointment, "BOOKING_FEE")) {
      return next(errorHandler(400, "Invalid booking fee amount"));
    }

    const payment = await createPaymentRecord({
      appointment,
      method,
      amount: bookingFeeAmount,
      type: "BOOKING_FEE",
      customer: req.user
    });

    let gateway: any = null;
    if (method === "MPESA") {
      gateway = await initiateMpesaForAppointment({
        appointment,
        payment,
        amount: bookingFeeAmount,
        phone
      });
    } else if (method === "CARD") {
      gateway = await initiatePaystackForAppointment({
        appointment,
        payment,
        amount: bookingFeeAmount,
        email
      });
    }

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("customerId", "firstName lastName email phone")
      .populate("staffId", "firstName lastName email phone")
      .populate("services", "name duration fullPrice");

    res.status(200).json({
      success: true,
      message: "Booking fee payment initiated",
      data: { populatedAppointment, payment, gateway }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while confirming appointment"));
  }
};
```

#### `rescheduleAppointment()`
**Purpose:** Move appointment to a new time  
**Access:** Admin/Staff (or customer if allowed)  
**Validation:**
- Appointment must exist
- Appointment status must be `CONFIRMED` (only confirmed appointments can be rescheduled)
- New slot must be available (validated using `checkSlotAvailability` - checks working hours, existing appointments, and breaks)

**Controller Implementation:**
```typescript
export const rescheduleAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const { startTime, endTime } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be rescheduled"));
    }

    if (!startTime || !endTime) {
      return next(errorHandler(400, "startTime and endTime are required"));
    }

    const slotCheck = await checkSlotAvailability({
      staffId: appointment.staffId.toString(),
      serviceIds: (appointment.services || []).map((id) => id.toString()),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      excludeAppointmentId: appointment._id.toString()
    });
    if (!slotCheck.ok) {
      return next(errorHandler(400, slotCheck.message || "Appointment time is not available"));
    }

    appointment.startTime = startTime;
    appointment.endTime = endTime;
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while rescheduling appointment"));
  }
};
```

#### `cancelAppointment()`
**Purpose:** Cancel appointment  
**Access:** Customer/Admin/Staff  
**Validation:**
- Appointment must exist
- Appointment status must be `CONFIRMED` (only confirmed appointments can be cancelled)
- Cancellation must be at least 2 hours before the appointment start time
**Process:** Set status to `CANCELLED` and optionally trigger refunds or notifications

**Controller Implementation:**
```typescript
export const cancelAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be cancelled"));
    }

    const now = new Date();
    const hoursUntilStart = (appointment.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilStart < 2) {
      return next(errorHandler(400, "Appointments can only be cancelled at least 2 hours before start time"));
    }

    appointment.status = "CANCELLED";
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment cancelled",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while cancelling appointment"));
  }
};
```

#### `checkIn()`
**Purpose:** Mark customer arrival  
**Access:** Staff/Admin  
**Validation:**
- Appointment must exist
- Appointment status must be `CONFIRMED` (only confirmed appointments can be checked in)
- Check-in is only allowed on the same day as the appointment start time
**Process:** Set `checkedInAt`

**Controller Implementation:**
```typescript
export const checkIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be checked in"));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(appointment.startTime);
    appointmentDate.setHours(0, 0, 0, 0);
    if (today.getTime() !== appointmentDate.getTime()) {
      return next(errorHandler(400, "Check-in is only allowed on the day of the appointment"));
    }

    appointment.checkedInAt = new Date();
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Customer checked in",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while checking in"));
  }
};
```

#### `completeAppointment()`
**Purpose:** Mark appointment completed  
**Access:** Staff  
**Process:** Set status `COMPLETED` and `actualEndTime`

**Controller Implementation:**
```typescript
export const completeAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    appointment.status = "COMPLETED";
    appointment.actualEndTime = new Date();
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment completed",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while completing appointment"));
  }
};
```

#### `markNoShow()`
**Purpose:** Mark no-show  
**Access:** Staff/Admin  
**Validation:**
- Appointment must exist
- Appointment status must be `CONFIRMED` (only confirmed appointments can be marked as no-show)
**Process:** Set status `NO_SHOW`

**Controller Implementation:**
```typescript
export const markNoShow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be marked as no-show"));
    }

    appointment.status = "NO_SHOW";
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment marked as no-show",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while marking no-show"));
  }
};
```

#### `getAppointments()`
**Purpose:** List appointments  
**Access:** Admin/Staff  
**Filters:** status, staffId, date range  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Sorting:** Results are sorted by `createdAt` in descending order (latest first)

**Controller Implementation:**
```typescript
export const getAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, staffId, startDate, endDate, page = 1, limit = 10 } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (staffId) query.staffId = staffId;
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(String(startDate));
      if (endDate) query.startTime.$lte = new Date(String(endDate));
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query appointments with pagination
    const appointments = await Appointment.find(query)
      .populate("customerId", "firstName lastName phone")
      .populate("staffId", "firstName lastName email phone")
      .populate("services", "name duration fullPrice")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        appointments,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalAppointments: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching appointments"));
  }
};
```

#### `getMyAppointments()`
**Purpose:** Customer's appointments  
**Access:** Authenticated  
**Filters:** status, date range  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Sorting:** Results are sorted by `createdAt` in descending order (latest first)

**Controller Implementation:**
```typescript
export const getMyAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
    const query: any = { customerId: req.user?._id };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(String(startDate));
      if (endDate) query.startTime.$lte = new Date(String(endDate));
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query appointments with pagination
    const appointments = await Appointment.find(query)
      .populate("staffId", "firstName lastName email phone")
      .populate("services", "name duration fullPrice")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        appointments,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalAppointments: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching appointments"));
  }
};
```

#### `getAppointmentById(appointmentId)`
**Purpose:** Fetch a single appointment by id  
**Access:** Authenticated (admin/staff/customer)  
**Validation:** Appointment must exist  
**Process:** Find by id and populate customer, staff, services  
**Response:** Appointment record

**Controller Implementation:**
```typescript
export const getAppointmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId)
      .populate("customerId", "firstName lastName email phone")
      .populate("staffId", "firstName lastName email phone")
      .populate("services", "name duration fullPrice");

    if (!appointment) {
      return next(errorHandler(404, "Appointment not found"));
    }

    res.status(200).json({
      success: true,
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching appointment"));
  }
};
```

---

## 🛣️ Appointment Routes

### Base Path: `/api/appointments`

```typescript
POST   /                          // Create appointment
POST   /admin/create              // Create appointment (admin/staff)
POST   /:appointmentId/confirm    // Confirm appointment
PATCH  /:appointmentId/reschedule // Reschedule
PATCH  /:appointmentId/cancel     // Cancel
PATCH  /:appointmentId/check-in   // Check in
PATCH  /:appointmentId/complete   // Complete
PATCH  /:appointmentId/no-show    // No-show
GET    /                          // List appointments (admin/staff)
GET    /my                        // Customer appointments
GET    /:appointmentId            // Get appointment by id
DELETE /:appointmentId            // Delete appointment
```

### Router Implementation

**File: `src/routes/appointmentRoutes.ts`**

```typescript
import express from "express";
import {
  createAppointment,
  createAppointmentAdmin,
  confirmAppointment,
  rescheduleAppointment,
  cancelAppointment,
  checkIn,
  completeAppointment,
  markNoShow,
  getAppointments,
  getMyAppointments,
  getAppointmentById,
  deleteAppointment
} from "../controllers/appointmentController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

router.post("/", authenticateToken, authorizeRoles(["customer", "admin"]), createAppointment);
router.post("/admin/create", authenticateToken, authorizeRoles(["admin", "staff"]), createAppointmentAdmin);
router.post("/:appointmentId/confirm", authenticateToken, authorizeRoles(["admin", "staff", "customer"]), confirmAppointment);
router.patch("/:appointmentId/reschedule", authenticateToken, authorizeRoles(["admin", "staff", "customer"]), rescheduleAppointment);
router.patch("/:appointmentId/cancel", authenticateToken, authorizeRoles(["admin", "staff", "customer"]), cancelAppointment);
router.patch("/:appointmentId/check-in", authenticateToken, authorizeRoles(["staff", "admin"]), checkIn);
router.patch("/:appointmentId/complete", authenticateToken, authorizeRoles(["staff", "admin"]), completeAppointment);
router.patch("/:appointmentId/no-show", authenticateToken, authorizeRoles(["staff", "admin"]), markNoShow);
router.get("/", authenticateToken, authorizeRoles(["admin", "staff"]), getAppointments);
router.get("/my", authenticateToken, getMyAppointments);
router.get("/:appointmentId", authenticateToken, getAppointmentById);
router.delete("/:appointmentId", authenticateToken, authorizeRoles(["admin", "staff"]), deleteAppointment);

export default router;
```

### Route Details

#### `POST /api/appointments`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**
```json
{
  "staffId": "...",
  "services": ["..."],
  "startTime": "2026-01-25T09:00:00.000Z",
  "endTime": "2026-01-25T10:30:00.000Z"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment created",
  "data": {
    "appointment": {
      "id": "...",
      "customerId": {
        "id": "...",
        "firstName": "Jane",
        "lastName": "Customer"
      },
      "staffId": {
        "id": "...",
        "firstName": "John",
        "lastName": "Staff"
      },
      "services": [
        {
          "id": "...",
          "name": "Haircut",
          "duration": 30,
          "fullPrice": 500
        }
      ],
      "status": "PENDING",
      "bookingFeeAmount": 200,
      "remainingAmount": 800
    }
  }
}
```
**Notes:**
- Customer is derived from the authenticated user (no `customerId` in body).
- An in-app notification is sent to the customer with an action to confirm the appointment.

#### `POST /api/appointments/admin/create`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**
```json
{
  "userId": "...",
  "staffId": "...",
  "services": ["..."],
  "startTime": "2026-01-25T09:00:00.000Z",
  "endTime": "2026-01-25T10:30:00.000Z"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment created successfully by admin",
  "data": {
    "appointment": {
      "id": "...",
      "customerId": {
        "id": "...",
        "firstName": "Jane",
        "lastName": "Customer"
      },
      "staffId": {
        "id": "...",
        "firstName": "John",
        "lastName": "Staff"
      },
      "services": [
        {
          "id": "...",
          "name": "Haircut",
          "duration": 30,
          "fullPrice": 500
        }
      ],
      "status": "PENDING",
      "bookingFeeAmount": 200,
      "remainingAmount": 800
    }
  }
}
```
**Notes:**
- Allows admin/staff to create appointments for any user by providing `userId`.
- Sends an in-app notification to the customer.

#### `POST /api/appointments/:appointmentId/confirm`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**
```json
{
  "method": "MPESA",
  "phone": "+254712345679"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Booking fee payment initiated",
  "data": {
    "appointment": {
      "id": "...",
      "customerId": { "id": "...", "firstName": "Jane", "lastName": "Customer" },
      "staffId": { "id": "...", "firstName": "John", "lastName": "Staff" },
      "services": [
        { "id": "...", "name": "Haircut", "duration": 30, "fullPrice": 500 }
      ],
      "status": "PENDING"
    },
    "payment": { "id": "...", "status": "PENDING" },
    "gateway": { "checkoutRequestId": "...", "merchantRequestId": "..." }
  }
}
```

#### `PATCH /api/appointments/:appointmentId/reschedule`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**
```json
{
  "startTime": "2026-01-26T10:00:00.000Z",
  "endTime": "2026-01-26T11:30:00.000Z"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment rescheduled",
  "data": {
    "appointment": {
      "id": "...",
      "startTime": "2026-01-26T10:00:00.000Z",
      "endTime": "2026-01-26T11:30:00.000Z"
    }
  }
}
```

#### `PATCH /api/appointments/:appointmentId/cancel`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "message": "Appointment cancelled",
  "data": {
    "appointment": {
      "id": "...",
      "status": "CANCELLED"
    }
  }
}
```

#### `PATCH /api/appointments/:appointmentId/check-in`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "message": "Customer checked in",
  "data": {
    "appointment": {
      "id": "...",
      "checkedInAt": "2026-01-25T09:05:00.000Z"
    }
  }
}
```

#### `PATCH /api/appointments/:appointmentId/complete`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "message": "Appointment completed",
  "data": {
    "appointment": {
      "id": "...",
      "status": "COMPLETED",
      "actualEndTime": "2026-01-25T10:32:00.000Z"
    }
  }
}
```

#### `PATCH /api/appointments/:appointmentId/no-show`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "message": "Appointment marked as no-show",
  "data": {
    "appointment": {
      "id": "...",
      "status": "NO_SHOW"
    }
  }
}
```

#### `GET /api/appointments`
**Headers:** `Authorization: Bearer <token>`  
**Query:** `status`, `staffId`, `startDate`, `endDate`, `page`, `limit`
**Response:**
```json
{
  "success": true,
  "data": {
    "appointments": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalAppointments": 0,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/appointments/my`
**Headers:** `Authorization: Bearer <token>`  
**Query:** `status`, `startDate`, `endDate`, `page`, `limit`
**Response:**
```json
{
  "success": true,
  "data": {
    "appointments": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalAppointments": 0,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/appointments/:appointmentId`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "...",
      "customerId": { "id": "...", "firstName": "Jane", "lastName": "Customer" },
      "staffId": { "id": "...", "firstName": "John", "lastName": "Staff" },
      "services": [
        { "id": "...", "name": "Haircut", "duration": 30, "fullPrice": 500 }
      ],
      "status": "PENDING"
    }
  }
}
```

#### `DELETE /api/appointments/:appointmentId`
**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin/Staff  
**Response:**
```json
{
  "success": true,
  "message": "Appointment deleted successfully",
  "data": {
    "appointmentId": "..."
  }
}
```
**Notes:**
- Permanently deletes the appointment from the database
- Related payments remain in the database for audit purposes (orphaned records)

---

## 🔐 Middleware

### Authentication Middleware
- `authenticateToken` - Verify JWT token  
- `authorizeRoles(allowedRoles)` - Role-based access control  

Usage:
```typescript
router.post("/", authenticateToken, authorizeRoles(["customer", "admin"]), createAppointment);
```

---

## 📝 API Examples

### Create Appointment (Customer)
```bash
curl -X POST http://localhost:4500/api/appointments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "64f9...",
    "services": ["64a1...", "64b2..."],
    "startTime": "2026-01-25T09:00:00.000Z",
    "endTime": "2026-01-25T10:30:00.000Z"
  }'
```

### Create Appointment for User (Admin)
```bash
curl -X POST http://localhost:4500/api/appointments/admin/create \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "64f9_USER_ID",
    "staffId": "64f9_STAFF_ID",
    "services": ["64a1_SERVICE_ID"],
    "startTime": "2026-01-25T11:00:00.000Z",
    "endTime": "2026-01-25T12:00:00.000Z"
  }'
```

### Reschedule Appointment
```bash
curl -X PATCH http://localhost:4500/api/appointments/<appointmentId>/reschedule \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2026-01-26T10:00:00.000Z",
    "endTime": "2026-01-26T11:30:00.000Z"
  }'
```

### Delete Appointment
```bash
curl -X DELETE http://localhost:4500/api/appointments/<appointmentId> \
  -H "Authorization: Bearer <admin_or_staff_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment deleted successfully",
  "data": {
    "appointmentId": "..."
  }
}
```

---

## 🛡️ Security Features

- **RBAC:** Customers can create/view their appointments; staff/admin manage schedules.
- **Validation:** Rejects invalid times and unavailable slots.
- **Computed Amounts:** Booking fee and remaining amount are computed server-side.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Appointment not found" }
```
```json
{ "success": false, "message": "Selected time slot is unavailable" }
```

---

## 📊 Database Indexes

```typescript
appointmentSchema.index({ staffId: 1, startTime: 1, endTime: 1 });
appointmentSchema.index({ customerId: 1, startTime: 1 });
appointmentSchema.index({ services: 1 });
```

---

**Last Updated:** March 2026  
**Version:** 1.0.1
