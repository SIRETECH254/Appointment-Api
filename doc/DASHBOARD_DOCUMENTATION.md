# 📊 Appointment API - Dashboard Statistics Documentation

## 📋 Table of Contents
- [Dashboard Overview](#dashboard-overview)
- [Dashboard Controller](#-dashboard-controller)
- [Dashboard Routes](#-dashboard-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Period Calculation](#-period-calculation)

---

## Dashboard Overview

The Dashboard provides comprehensive statistical insights comparing current period data against previous periods. It aggregates data from appointments, payments, users, and services to show key metrics with period-over-period comparisons. This enables administrators to track business performance, revenue trends, and operational metrics over time.

Key features:
- Period-based comparisons (today, week, month, year)
- Revenue tracking and trends
- Appointment statistics by status
- Payment analytics by method and type
- User growth and activity metrics
- Service popularity analysis

---

## 🎮 Dashboard Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Appointment from "../models/Appointment";
import Payment from "../models/Payment";
import User from "../models/User";
import Service from "../models/Service";
import Role from "../models/Role";
```

### Functions Overview

#### `getDashboardStats()`
**Purpose:** Get comprehensive dashboard statistics for a specified period  
**Access:** Admin  
**Validation:**
- `period` query parameter must be one of: `today`, `week`, `month`, `year` (default: `month`)
**Process:**
- Calculate current and previous period date ranges
- Aggregate statistics from appointments, payments, users, and services
- Calculate percentage changes between periods
- Generate daily revenue breakdown for current period
**Response:** Complete dashboard statistics object

**Controller Implementation:**
```typescript
export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { period = "month" } = req.query;
    
    // Validate period parameter
    const validPeriods = ["today", "week", "month", "year"];
    if (typeof period !== "string" || !validPeriods.includes(period)) {
      return next(errorHandler(400, "Invalid period. Must be one of: today, week, month, year"));
    }

    // Calculate period date ranges
    const { current, previous } = calculatePeriodRanges(period);

    // Fetch all statistics in parallel for better performance
    const [
      appointmentStats,
      paymentStats,
      userStats,
      serviceStats,
      revenueTrends
    ] = await Promise.all([
      getAppointmentStatistics(current, previous),
      getPaymentStatistics(current, previous),
      getUserStatistics(current, previous),
      getServiceStatistics(),
      getRevenueTrends(current)
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: {
          current: { start: current.start, end: current.end },
          previous: { start: previous.start, end: previous.end }
        },
        appointments: appointmentStats,
        payments: paymentStats,
        users: userStats,
        services: serviceStats,
        revenue: revenueTrends
      }
    });
  } catch (error: any) {
    console.error("Get dashboard stats error:", error);
    next(errorHandler(500, "Server error while fetching dashboard statistics"));
  }
};
```

#### Helper Functions

##### `calculatePeriodRanges(period)`
**Purpose:** Calculate current and previous period date ranges  
**Access:** Internal helper  
**Validation:** Period must be valid  
**Process:** Calculate start and end dates for current and previous periods based on period type  
**Response:** Object with current and previous period date ranges

**Implementation:**
```typescript
interface PeriodRange {
  start: Date;
  end: Date;
}

const calculatePeriodRanges = (period: string): { current: PeriodRange; previous: PeriodRange } => {
  const now = new Date();
  let currentStart: Date;
  let currentEnd: Date = new Date(now);
  currentEnd.setHours(23, 59, 59, 999);

  // Calculate current period
  switch (period) {
    case "today":
      currentStart = new Date(now);
      currentStart.setHours(0, 0, 0, 0);
      break;
    case "week":
      // Get Monday of current week
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      currentStart = new Date(now.setDate(diff));
      currentStart.setHours(0, 0, 0, 0);
      break;
    case "month":
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStart.setHours(0, 0, 0, 0);
      break;
    case "year":
      currentStart = new Date(now.getFullYear(), 0, 1);
      currentStart.setHours(0, 0, 0, 0);
      break;
    default:
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStart.setHours(0, 0, 0, 0);
  }

  // Calculate previous period
  const currentDuration = currentEnd.getTime() - currentStart.getTime();
  const previousEnd = new Date(currentStart.getTime() - 1);
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd.getTime() - currentDuration);
  previousStart.setHours(0, 0, 0, 0);

  return {
    current: { start: currentStart, end: currentEnd },
    previous: { start: previousStart, end: previousEnd }
  };
};
```

##### `getAppointmentStatistics(current, previous)`
**Purpose:** Get appointment statistics for current and previous periods  
**Access:** Internal helper  
**Process:**
- Count total appointments in each period
- Group appointments by status
- Calculate revenue from appointments (bookingFeeAmount + remainingAmount for completed appointments)
- Calculate average appointment value
- Calculate percentage changes
**Response:** Appointment statistics object

**Implementation:**
```typescript
const getAppointmentStatistics = async (
  current: PeriodRange,
  previous: PeriodRange
): Promise<any> => {
  // Current period queries
  const currentAppointments = await Appointment.find({
    createdAt: { $gte: current.start, $lte: current.end }
  });

  const currentTotal = currentAppointments.length;
  const currentByStatus = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0
  };

  let currentRevenue = 0;
  currentAppointments.forEach((apt) => {
    currentByStatus[apt.status as keyof typeof currentByStatus]++;
    if (apt.status === "COMPLETED") {
      currentRevenue += apt.bookingFeeAmount + apt.remainingAmount;
    }
  });

  const currentAvgValue = currentTotal > 0 ? currentRevenue / currentTotal : 0;

  // Previous period queries
  const previousAppointments = await Appointment.find({
    createdAt: { $gte: previous.start, $lte: previous.end }
  });

  const previousTotal = previousAppointments.length;
  const previousByStatus = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0
  };

  let previousRevenue = 0;
  previousAppointments.forEach((apt) => {
    previousByStatus[apt.status as keyof typeof previousByStatus]++;
    if (apt.status === "COMPLETED") {
      previousRevenue += apt.bookingFeeAmount + apt.remainingAmount;
    }
  });

  // Calculate percentage changes
  const totalChange = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : currentTotal > 0 ? 100 : 0;
  
  const revenueChange = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : currentRevenue > 0 ? 100 : 0;

  return {
    current: {
      total: currentTotal,
      byStatus: currentByStatus,
      revenue: currentRevenue,
      avgValue: currentAvgValue
    },
    previous: {
      total: previousTotal,
      byStatus: previousByStatus,
      revenue: previousRevenue,
      avgValue: previousTotal > 0 ? previousRevenue / previousTotal : 0
    },
    change: {
      total: Math.round(totalChange * 100) / 100,
      revenue: Math.round(revenueChange * 100) / 100
    }
  };
};
```

##### `getPaymentStatistics(current, previous)`
**Purpose:** Get payment statistics for current and previous periods  
**Access:** Internal helper  
**Process:**
- Sum total revenue from successful payments
- Group revenue by payment method (MPESA, CARD, CASH)
- Group revenue by payment type (BOOKING_FEE, FULL_PAYMENT)
- Calculate payment success rate
- Count total successful payments
- Calculate percentage changes
**Response:** Payment statistics object

**Implementation:**
```typescript
const getPaymentStatistics = async (
  current: PeriodRange,
  previous: PeriodRange
): Promise<any> => {
  // Current period - successful payments only
  const currentPayments = await Payment.find({
    createdAt: { $gte: current.start, $lte: current.end },
    status: "SUCCESS"
  });

  let currentTotal = 0;
  const currentByMethod = { MPESA: 0, CARD: 0, CASH: 0 };
  const currentByType = { BOOKING_FEE: 0, FULL_PAYMENT: 0 };
  let currentSuccessCount = 0;

  currentPayments.forEach((payment) => {
    currentTotal += payment.amount;
    currentByMethod[payment.method as keyof typeof currentByMethod] += payment.amount;
    currentByType[payment.type as keyof typeof currentByType] += payment.amount;
    currentSuccessCount++;
  });

  // Get all payments (for success rate calculation)
  const currentAllPayments = await Payment.find({
    createdAt: { $gte: current.start, $lte: current.end }
  });
  const currentSuccessRate = currentAllPayments.length > 0 
    ? (currentSuccessCount / currentAllPayments.length) * 100 
    : 0;

  // Previous period
  const previousPayments = await Payment.find({
    createdAt: { $gte: previous.start, $lte: previous.end },
    status: "SUCCESS"
  });

  let previousTotal = 0;
  const previousByMethod = { MPESA: 0, CARD: 0, CASH: 0 };
  const previousByType = { BOOKING_FEE: 0, FULL_PAYMENT: 0 };
  let previousSuccessCount = 0;

  previousPayments.forEach((payment) => {
    previousTotal += payment.amount;
    previousByMethod[payment.method as keyof typeof previousByMethod] += payment.amount;
    previousByType[payment.type as keyof typeof previousByType] += payment.amount;
    previousSuccessCount++;
  });

  const previousAllPayments = await Payment.find({
    createdAt: { $gte: previous.start, $lte: previous.end }
  });
  const previousSuccessRate = previousAllPayments.length > 0 
    ? (previousSuccessCount / previousAllPayments.length) * 100 
    : 0;

  // Calculate percentage change
  const totalChange = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : currentTotal > 0 ? 100 : 0;

  return {
    current: {
      total: currentTotal,
      byMethod: currentByMethod,
      byType: currentByType,
      successRate: Math.round(currentSuccessRate * 100) / 100,
      successCount: currentSuccessCount
    },
    previous: {
      total: previousTotal,
      byMethod: previousByMethod,
      byType: previousByType,
      successRate: Math.round(previousSuccessRate * 100) / 100,
      successCount: previousSuccessCount
    },
    change: {
      total: Math.round(totalChange * 100) / 100
    }
  };
};
```

##### `getUserStatistics(current, previous)`
**Purpose:** Get user statistics for current and previous periods  
**Access:** Internal helper  
**Process:**
- Count total users created in each period
- Count users by role (customer, admin, staff)
- Count active users
- Calculate percentage changes
**Response:** User statistics object

**Implementation:**
```typescript
const getUserStatistics = async (
  current: PeriodRange,
  previous: PeriodRange
): Promise<any> => {
  // Get role IDs for filtering
  const customerRole = await Role.findOne({ name: "customer" }).select("_id");
  const adminRole = await Role.findOne({ name: "admin" }).select("_id");
  const staffRole = await Role.findOne({ name: "staff" }).select("_id");

  // Current period
  const currentUsers = await User.find({
    createdAt: { $gte: current.start, $lte: current.end }
  }).populate("roles", "name");

  const currentTotal = currentUsers.length;
  const currentByRole = { customer: 0, admin: 0, staff: 0 };
  let currentActive = 0;

  currentUsers.forEach((user) => {
    if (user.isActive) currentActive++;
    if (user.roles && Array.isArray(user.roles)) {
      user.roles.forEach((role: any) => {
        const roleName = role?.name || (typeof role === "string" ? role : "");
        if (roleName === "customer") currentByRole.customer++;
        if (roleName === "admin") currentByRole.admin++;
        if (roleName === "staff") currentByRole.staff++;
      });
    }
  });

  // Previous period
  const previousUsers = await User.find({
    createdAt: { $gte: previous.start, $lte: previous.end }
  }).populate("roles", "name");

  const previousTotal = previousUsers.length;
  const previousByRole = { customer: 0, admin: 0, staff: 0 };
  let previousActive = 0;

  previousUsers.forEach((user) => {
    if (user.isActive) previousActive++;
    if (user.roles && Array.isArray(user.roles)) {
      user.roles.forEach((role: any) => {
        const roleName = role?.name || (typeof role === "string" ? role : "");
        if (roleName === "customer") previousByRole.customer++;
        if (roleName === "admin") previousByRole.admin++;
        if (roleName === "staff") previousByRole.staff++;
      });
    }
  });

  // Calculate percentage change
  const totalChange = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : currentTotal > 0 ? 100 : 0;

  return {
    current: {
      total: currentTotal,
      byRole: currentByRole,
      active: currentActive
    },
    previous: {
      total: previousTotal,
      byRole: previousByRole,
      active: previousActive
    },
    change: {
      total: Math.round(totalChange * 100) / 100
    }
  };
};
```

##### `getServiceStatistics()`
**Purpose:** Get service statistics (not period-based)  
**Access:** Internal helper  
**Process:**
- Count total services
- Count active services
- Get most popular services by appointment count
**Response:** Service statistics object

**Implementation:**
```typescript
const getServiceStatistics = async (): Promise<any> => {
  // Get total and active service counts
  const totalServices = await Service.countDocuments();
  const activeServices = await Service.countDocuments({ isActive: true });

  // Get most popular services by appointment count
  const popularServices = await Appointment.aggregate([
    { $unwind: "$services" },
    {
      $group: {
        _id: "$services",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  // Populate service names
  const popularServicesWithNames = await Promise.all(
    popularServices.map(async (item) => {
      const service = await Service.findById(item._id).select("name");
      return {
        serviceId: item._id.toString(),
        name: service?.name || "Unknown",
        count: item.count
      };
    })
  );

  return {
    total: totalServices,
    active: activeServices,
    popular: popularServicesWithNames
  };
};
```

##### `getRevenueTrends(current)`
**Purpose:** Get daily revenue breakdown for current period  
**Access:** Internal helper  
**Process:**
- Group successful payments by day
- Sum revenue for each day
- Return array of daily revenue data
**Response:** Revenue trends object with daily breakdown

**Implementation:**
```typescript
const getRevenueTrends = async (current: PeriodRange): Promise<any> => {
  // Get all successful payments in current period
  const payments = await Payment.find({
    createdAt: { $gte: current.start, $lte: current.end },
    status: "SUCCESS"
  });

  // Calculate total revenue
  const currentRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

  // Get previous period for comparison
  const previousDuration = current.end.getTime() - current.start.getTime();
  const previousEnd = new Date(current.start.getTime() - 1);
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd.getTime() - previousDuration);
  previousStart.setHours(0, 0, 0, 0);

  const previousPayments = await Payment.find({
    createdAt: { $gte: previousStart, $lte: previousEnd },
    status: "SUCCESS"
  });

  const previousRevenue = previousPayments.reduce((sum, payment) => sum + payment.amount, 0);

  // Calculate percentage change
  const revenueChange = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : currentRevenue > 0 ? 100 : 0;

  // Group by day for daily breakdown
  const dailyRevenue: { [key: string]: number } = {};
  payments.forEach((payment) => {
    const dateKey = payment.createdAt.toISOString().split("T")[0];
    if (!dailyRevenue[dateKey]) {
      dailyRevenue[dateKey] = 0;
    }
    dailyRevenue[dateKey] += payment.amount;
  });

  // Convert to array and sort by date
  const daily = Object.entries(dailyRevenue)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    current: currentRevenue,
    previous: previousRevenue,
    change: Math.round(revenueChange * 100) / 100,
    daily
  };
};
```

---

## 🛣️ Dashboard Routes

### Base Path: `/api/dashboard`

```typescript
GET    /stats                    // Get dashboard statistics (admin)
```

### Router Implementation

**File: `src/routes/dashboardRoutes.ts`**

```typescript
import express from "express";
import { getDashboardStats } from "../controllers/dashboardController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

// Admin only - get dashboard statistics
router.get("/stats", authenticateToken, requireAdmin, getDashboardStats);

export default router;
```

### Route Details

#### `GET /api/dashboard/stats`
**Headers:** `Authorization: Bearer <admin_token>`  
**Query Parameters:**
- `period` (optional): `today` | `week` | `month` | `year` (default: `month`)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "current": {
        "start": "2026-01-01T00:00:00.000Z",
        "end": "2026-01-31T23:59:59.999Z"
      },
      "previous": {
        "start": "2025-12-01T00:00:00.000Z",
        "end": "2025-12-31T23:59:59.999Z"
      }
    },
    "appointments": {
      "current": {
        "total": 150,
        "byStatus": {
          "PENDING": 20,
          "CONFIRMED": 50,
          "COMPLETED": 70,
          "CANCELLED": 8,
          "NO_SHOW": 2
        },
        "revenue": 350000,
        "avgValue": 2333.33
      },
      "previous": {
        "total": 120,
        "byStatus": {
          "PENDING": 15,
          "CONFIRMED": 40,
          "COMPLETED": 60,
          "CANCELLED": 4,
          "NO_SHOW": 1
        },
        "revenue": 280000,
        "avgValue": 2333.33
      },
      "change": {
        "total": 25.0,
        "revenue": 25.0
      }
    },
    "payments": {
      "current": {
        "total": 380000,
        "byMethod": {
          "MPESA": 200000,
          "CARD": 150000,
          "CASH": 30000
        },
        "byType": {
          "BOOKING_FEE": 50000,
          "FULL_PAYMENT": 330000
        },
        "successRate": 95.5,
        "successCount": 150
      },
      "previous": {
        "total": 300000,
        "byMethod": {
          "MPESA": 180000,
          "CARD": 100000,
          "CASH": 20000
        },
        "byType": {
          "BOOKING_FEE": 40000,
          "FULL_PAYMENT": 260000
        },
        "successRate": 94.0,
        "successCount": 120
      },
      "change": {
        "total": 26.67
      }
    },
    "users": {
      "current": {
        "total": 45,
        "byRole": {
          "customer": 40,
          "admin": 2,
          "staff": 3
        },
        "active": 42
      },
      "previous": {
        "total": 35,
        "byRole": {
          "customer": 32,
          "admin": 1,
          "staff": 2
        },
        "active": 33
      },
      "change": {
        "total": 28.57
      }
    },
    "services": {
      "total": 15,
      "active": 12,
      "popular": [
        {
          "serviceId": "64f3...",
          "name": "Haircut",
          "count": 80
        },
        {
          "serviceId": "64f4...",
          "name": "Hair Color",
          "count": 50
        }
      ]
    },
    "revenue": {
      "current": 380000,
      "previous": 300000,
      "change": 26.67,
      "daily": [
        {
          "date": "2026-01-01",
          "amount": 12000
        },
        {
          "date": "2026-01-02",
          "amount": 15000
        }
      ]
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
router.get("/stats", authenticateToken, requireAdmin, getDashboardStats);
```

#### `requireAdmin`
**Purpose:** Admin-only operations  
**Usage:**
```typescript
router.get("/stats", authenticateToken, requireAdmin, getDashboardStats);
```

---

## 📝 API Examples

### Get Dashboard Statistics (Current Month)
```bash
curl -X GET "http://localhost:4500/api/dashboard/stats?period=month" \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "current": { "start": "...", "end": "..." },
      "previous": { "start": "...", "end": "..." }
    },
    "appointments": { ... },
    "payments": { ... },
    "users": { ... },
    "services": { ... },
    "revenue": { ... }
  }
}
```

### Get Dashboard Statistics (Today)
```bash
curl -X GET "http://localhost:4500/api/dashboard/stats?period=today" \
  -H "Authorization: Bearer <admin_token>"
```

### Get Dashboard Statistics (This Week)
```bash
curl -X GET "http://localhost:4500/api/dashboard/stats?period=week" \
  -H "Authorization: Bearer <admin_token>"
```

### Get Dashboard Statistics (This Year)
```bash
curl -X GET "http://localhost:4500/api/dashboard/stats?period=year" \
  -H "Authorization: Bearer <admin_token>"
```

---

## 🛡️ Security Features

- **RBAC:** Admin-only access for dashboard statistics
- **Authentication:** JWT token required for all dashboard endpoints
- **Validation:** Period parameter validation to prevent injection
- **Data Privacy:** Only aggregate statistics are returned, no sensitive user data

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Invalid period. Must be one of: today, week, month, year" }
```

```json
{ "success": false, "message": "Server error while fetching dashboard statistics" }
```

---

## 📊 Period Calculation

### Today
- **Current:** Start of today (00:00:00) to end of today (23:59:59)
- **Previous:** Same time range for yesterday

### Week
- **Current:** Monday 00:00:00 to Sunday 23:59:59 of current week
- **Previous:** Same time range for previous week

### Month
- **Current:** First day of current month 00:00:00 to last day 23:59:59
- **Previous:** Same time range for previous month

### Year
- **Current:** January 1st 00:00:00 to December 31st 23:59:59 of current year
- **Previous:** Same time range for previous year

---

**Last Updated:** January 2026  
**Version:** 1.0.0
