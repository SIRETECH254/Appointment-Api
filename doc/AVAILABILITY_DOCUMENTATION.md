# 📆 Appointment API - Availability (Slots) Documentation

## 📋 Table of Contents
- [Availability Overview](#availability-overview)
- [Slot Logic (Core Summary)](#slot-logic-core-summary)
- [Availability Model](#-availability-model)
- [Availability Controller](#-availability-controller)
- [Availability Routes](#-availability-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Availability Overview

Availability (also called slots) is calculated dynamically. Slots are not stored in the database.

Key characteristics:
- Slots are computed on demand based on working hours, service duration, appointments, and breaks.
- The frontend only displays slots; it never decides availability.
- The backend re-validates availability during booking to prevent double booking.

Integration with Booking:
- Availability is a read-only view of possible start times.
- Booking must re-check overlaps before saving an appointment.

---

## Slot Logic (Core Summary)

This section explains the core slot logic only.

### What a Slot Is
- A slot is not stored in the database.
- A slot is a calculated start time where a service can fit inside a staff member’s working hours without overlapping an existing appointment or break.

### Data Used for Slot Calculation
Only four inputs are required:
- Staff working hours (e.g. 09:00–20:00)
- Service duration (e.g. 50 minutes)
- Existing appointments for the staff on the selected date
- Breaks for the staff on the selected date

### Slot Generation Process
1. Read staff working hours for the selected day.
2. Fetch all existing appointments for that staff on that date.
3. Fetch all breaks for that staff on that date.
4. Starting from the work start time, generate time ranges using the service duration.
5. For each generated slot, check if it overlaps any appointment or break.
6. Remove overlapping slots.
7. Return the remaining slots as available.

### Overlap Rule
A slot overlaps an appointment (or break) if:

```
slotStart < eventEnd
AND
slotEnd > eventStart
```

If this condition is true, the slot is invalid.

### Example
Working hours: 09:00 – 20:00  
Service duration: 50 minutes  
Existing appointments:
- 10:00 – 10:50
- 13:30 – 14:20
- 17:00 – 17:50

Breaks:
- 12:00 – 12:30

Available slots are all generated 50-minute time ranges that do not overlap the appointments or the break.

### Where This Logic Runs
Responsibility | Location
--- | ---
Slot calculation | Backend
Slot display | Frontend
Slot validation | Backend

### Booking Validation Rule
Even after a slot is shown to the user:
- The backend re-checks for overlapping appointments and breaks.
- If a conflict exists, the booking is rejected.
- If no conflict exists, the appointment is created.

---

## 🧩 Availability Model

Slots are not persisted; there is no Availability model.  
Availability uses:
- `User.workingHours` for staff schedules
- `Service.duration` for slot length (summed when multiple services are requested)
- `Appointment` records for booked time
- `Break` records for staff downtime

---

## 🎛️ Availability Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Service from "../models/Service";
import Appointment from "../models/Appointment";
import BreakModel from "../models/Break";
```

### Functions Overview

#### `getAvailableSlots()`
**Purpose:** Calculate available slots for a staff member on a date  
**Access:** Public  
**Validation:** `staffId`, `serviceId`, `date` required  
**Process:** Sum service durations, validate staff services, remove overlaps, filter past slots for today  
**Response:** Array of available slots

**Controller Implementation:**
```typescript
export const getAvailableSlots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, serviceId, date } = req.query;

    if (!staffId || !serviceId || !date) {
      return next(errorHandler(400, "staffId, serviceId and date are required"));
    }

    const staffIdStr = String(staffId);
    const serviceIds = toServiceIdList(serviceId as string | string[]);
    const dateStr = String(date);

    if (!isValidObjectId(staffIdStr) || serviceIds.some((id) => !isValidObjectId(id))) {
      return next(errorHandler(400, "Invalid staffId or serviceId"));
    }

    const dateOnly = parseDateOnly(dateStr);
    if (!dateOnly) {
      return next(errorHandler(400, "Invalid date format. Use YYYY-MM-DD"));
    }

    const todayStart = startOfToday();
    if (dateOnly < todayStart) {
      return res.status(200).json({
        success: true,
        message: "date has passed",
        data: { slots: [] }
      });
    }

    const staff = await User.findById(staffIdStr).select("workingHours services");
    if (!staff) {
      return next(errorHandler(404, "Staff not found"));
    }

    if (!staff.services || staff.services.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No services assigned to staff",
        data: { slots: [] }
      });
    }

    const staffServiceIds = staff.services.map((id) => id.toString());
    const hasAllServices = serviceIds.every((id) => staffServiceIds.includes(id));
    if (!hasAllServices) {
      return next(errorHandler(400, "Staff does not provide requested services"));
    }

    const services = await Service.find({ _id: { $in: serviceIds } }).select("duration");
    if (services.length !== serviceIds.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    const totalDuration = services.reduce((sum, item) => sum + item.duration, 0);

    const dayKey = getDayKey(dateOnly);
    const workingRanges = staff.workingHours?.[dayKey as keyof typeof staff.workingHours] || [];

    if (!workingRanges || workingRanges.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No working hours for this day",
        data: { slots: [] }
      });
    }

    const { start, end } = buildDayRange(dateOnly);

    const appointments = await Appointment.find({
      staffId: staffIdStr,
      startTime: { $lt: end },
      endTime: { $gt: start }
    }).select("startTime endTime");

    const breaks = await BreakModel.find({
      staffId: staffIdStr,
      startTime: { $lt: end },
      endTime: { $gt: start }
    }).select("startTime endTime");

    const events: TimeRange[] = [
      ...appointments.map((item) => ({ start: item.startTime, end: item.endTime })),
      ...breaks.map((item) => ({ start: item.startTime, end: item.endTime }))
    ];

    const { availableSlots } = computeSlots(workingRanges, dateOnly, totalDuration, events);
    const now = new Date();
    const filteredSlots =
      dateOnly.getTime() === todayStart.getTime()
        ? availableSlots.filter((slot) => slot.end > now)
        : availableSlots;

    if (filteredSlots.length === 0 && dateOnly.getTime() === todayStart.getTime()) {
      return res.status(200).json({
        success: true,
        message: "time has passed",
        data: { slots: [] }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        slots: filteredSlots.map((slot) => ({
          startTime: slot.start,
          endTime: slot.end
        }))
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while calculating availability"));
  }
};
```

#### `getDayAvailability()`
**Purpose:** Return a day-level availability summary  
**Access:** Public  
**Validation:** `staffId`, `serviceId`, `date` required  
**Process:** Count total vs available slots, filter past slots for today  
**Response:** Day summary totals

**Controller Implementation:**
```typescript
export const getDayAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, serviceId, date } = req.query;

    if (!staffId || !serviceId || !date) {
      return next(errorHandler(400, "staffId, serviceId and date are required"));
    }

    const staffIdStr = String(staffId);
    const serviceIds = toServiceIdList(serviceId as string | string[]);
    const dateStr = String(date);

    if (!isValidObjectId(staffIdStr) || serviceIds.some((id) => !isValidObjectId(id))) {
      return next(errorHandler(400, "Invalid staffId or serviceId"));
    }

    const dateOnly = parseDateOnly(dateStr);
    if (!dateOnly) {
      return next(errorHandler(400, "Invalid date format. Use YYYY-MM-DD"));
    }

    const todayStart = startOfToday();
    if (dateOnly < todayStart) {
      return res.status(200).json({
        success: true,
        message: "date has passed",
        data: {
          date: dateStr,
          totalSlots: 0,
          availableSlots: 0
        }
      });
    }

    const staff = await User.findById(staffIdStr).select("workingHours services");
    if (!staff) {
      return next(errorHandler(404, "Staff not found"));
    }

    if (!staff.services || staff.services.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No services assigned to staff",
        data: {
          date: dateStr,
          totalSlots: 0,
          availableSlots: 0
        }
      });
    }

    const staffServiceIds = staff.services.map((id) => id.toString());
    const hasAllServices = serviceIds.every((id) => staffServiceIds.includes(id));
    if (!hasAllServices) {
      return next(errorHandler(400, "Staff does not provide requested services"));
    }

    const services = await Service.find({ _id: { $in: serviceIds } }).select("duration");
    if (services.length !== serviceIds.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    const totalDuration = services.reduce((sum, item) => sum + item.duration, 0);

    const dayKey = getDayKey(dateOnly);
    const workingRanges = staff.workingHours?.[dayKey as keyof typeof staff.workingHours] || [];

    if (!workingRanges || workingRanges.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No working hours for this day",
        data: {
          date: dateStr,
          totalSlots: 0,
          availableSlots: 0
        }
      });
    }

    const { start, end } = buildDayRange(dateOnly);

    const appointments = await Appointment.find({
      staffId: staffIdStr,
      startTime: { $lt: end },
      endTime: { $gt: start }
    }).select("startTime endTime");

    const breaks = await BreakModel.find({
      staffId: staffIdStr,
      startTime: { $lt: end },
      endTime: { $gt: start }
    }).select("startTime endTime");

    const events: TimeRange[] = [
      ...appointments.map((item) => ({ start: item.startTime, end: item.endTime })),
      ...breaks.map((item) => ({ start: item.startTime, end: item.endTime }))
    ];

    const { totalSlots, availableSlots } = computeSlots(
      workingRanges,
      dateOnly,
      totalDuration,
      events
    );

    const now = new Date();
    const filteredSlots =
      dateOnly.getTime() === todayStart.getTime()
        ? availableSlots.filter((slot) => slot.end > now)
        : availableSlots;

    if (filteredSlots.length === 0 && dateOnly.getTime() === todayStart.getTime()) {
      return res.status(200).json({
        success: true,
        message: "time has passed",
        data: {
          date: dateStr,
          totalSlots,
          availableSlots: 0
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        date: dateStr,
        totalSlots,
        availableSlots: filteredSlots.length
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching day availability"));
  }
};
```

---

## 🛣️ Availability Routes

### Base Path: `/api/availability`

```typescript
GET  /slots   // Available slots for staff + service + date
GET  /day     // Day availability summary
```

### Router Implementation

**File:** `src/routes/availabilityRoutes.ts`

```typescript
import express from "express";
import { getAvailableSlots, getDayAvailability } from "../controllers/availabilityController";

const router = express.Router();

router.get("/slots", getAvailableSlots);
router.get("/day", getDayAvailability);

export default router;
```

### Route Details

#### `GET /api/availability/slots`
**Query:** `staffId`, `serviceId`, `date`  
**Notes:**
- Multiple services are supported by repeating `serviceId` in the query string.
**Response:**
```json
{
  "success": true,
  "data": {
    "slots": [
      { "startTime": "2026-01-23T09:00:00.000Z", "endTime": "2026-01-23T09:50:00.000Z" }
    ]
  }
}
```

**Example (multiple services):**
```
/api/availability/slots?staffId=<staffId>&serviceId=<serviceId1>&serviceId=<serviceId2>&date=2026-01-23
```

#### `GET /api/availability/day`
**Query:** `staffId`, `serviceId`, `date`  
**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-01-23",
    "totalSlots": 18,
    "availableSlots": 15
  }
}
```

---

## 🔐 Middleware

- Public endpoints by default.
- Use auth middleware if you want to restrict access in production.

---

## 📝 API Examples

### Get Available Slots
```bash
curl -X GET "http://localhost:4500/api/availability/slots?staffId=<staffId>&serviceId=<serviceId>&date=2026-01-23"
```

### Get Day Availability Summary
```bash
curl -X GET "http://localhost:4500/api/availability/day?staffId=<staffId>&serviceId=<serviceId>&date=2026-01-23"
```

---

## 🛡️ Security Features

- Availability endpoints are read-only.
- Booking validation happens server-side to prevent double booking.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "staffId, serviceId and date are required" }
```

```json
{ "success": false, "message": "Staff not found" }
```

**Availability Messages:**
- `"date has passed"` when requesting a past date
- `"time has passed"` when requesting today and no future slots remain
- `"No working hours for this day"` when staff has no hours
- `"No services assigned to staff"` when staff has no services
- `"Staff does not provide requested services"` when a requested service is not assigned

---

## 📊 Database Indexes

```typescript
appointmentSchema.index({ staffId: 1, startTime: 1, endTime: 1 });
breakSchema.index({ staffId: 1, startTime: 1, endTime: 1 });
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
