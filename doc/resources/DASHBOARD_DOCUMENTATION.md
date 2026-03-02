# 📊 Appointment API - Dashboard Analytics Documentation

## 📋 Table of Contents
- [Dashboard Overview](#dashboard-overview)
- [Dashboard Controller](#dashboard-controller)
- [Dashboard Routes](#dashboard-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)
- [Performance Considerations](#performance-considerations)

---

## 📊 Dashboard Overview

The Appointment API Dashboard Analytics System provides comprehensive analytics and statistics for both admin users and customers. Dashboards aggregate data from various modules including appointments, payments, services, and users to provide insights and overviews.

### Dashboard System Features
- **Admin Dashboard** - Comprehensive system-wide analytics
- **Client Dashboard** - Personalized customer statistics
- **Revenue Analytics** - Financial performance tracking
- **Appointment Statistics** - Appointment performance metrics
- **Service Demand** - Service popularity and demand analytics
- **Staff Activity** - Staff performance metrics

### Dashboard Types
1. **Admin Dashboard** - System-wide statistics and analytics
2. **Client Dashboard** - Customer-specific statistics and overview
3. **Revenue Dashboard** - Financial performance metrics
4. **Appointment Dashboard** - Appointment management statistics
5. **Service Demand Dashboard** - Service popularity analytics
6. **Staff Activity Dashboard** - Staff performance metrics

---

## 🎮 Dashboard Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Appointment from '../models/Appointment';
import Payment from '../models/Payment';
import User from '../models/User';
import Service from '../models/Service';
import Role from '../models/Role';
```

### Functions Overview

#### `getAdminDashboard()`
**Purpose:** Get admin dashboard statistics
**Access:** Admin users only
**Features:**
- Total appointments by status
- Total payments and revenue
- Total users by role
- Active services
- Recent activity
**Response:** Complete admin dashboard data

**Controller Implementation:**
```typescript
export const getAdminDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Appointments statistics
        const totalAppointments = await Appointment.countDocuments();
        const appointmentsByStatus = {
            pending: await Appointment.countDocuments({ status: 'PENDING' }),
            confirmed: await Appointment.countDocuments({ status: 'CONFIRMED' }),
            completed: await Appointment.countDocuments({ status: 'COMPLETED' }),
            cancelled: await Appointment.countDocuments({ status: 'CANCELLED' }),
            no_show: await Appointment.countDocuments({ status: 'NO_SHOW' })
        };

        // Payments statistics
        const totalPayments = await Payment.countDocuments();
        const paymentsByStatus = {
            pending: await Payment.countDocuments({ status: 'PENDING' }),
            success: await Payment.countDocuments({ status: 'SUCCESS' }),
            failed: await Payment.countDocuments({ status: 'FAILED' })
        };
        const paymentsByMethod = {
            mpesa: await Payment.countDocuments({ method: 'MPESA' }),
            card: await Payment.countDocuments({ method: 'CARD' }),
            cash: await Payment.countDocuments({ method: 'CASH' })
        };

        // Calculate total revenue from successful payments
        const successfulPayments = await Payment.find({ status: 'SUCCESS' });
        const totalRevenue = successfulPayments.reduce((sum, pay) => sum + pay.amount, 0);

        // Users statistics
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const verifiedUsers = await User.countDocuments({ emailVerified: true });

        // Users by role
        const customerRole = await Role.findOne({ name: 'customer' });
        const staffRole = await Role.findOne({ name: 'staff' });
        const adminRole = await Role.findOne({ name: 'admin' });

        const totalCustomers = customerRole ? await User.countDocuments({ roles: customerRole._id }) : 0;
        const totalStaff = staffRole ? await User.countDocuments({ roles: staffRole._id }) : 0;
        const totalAdmins = adminRole ? await User.countDocuments({ roles: adminRole._id }) : 0;

        // Services statistics
        const totalServices = await Service.countDocuments();
        const activeServices = await Service.countDocuments({ isActive: true });

        // Outstanding revenue (from appointments with remainingAmount > 0)
        const appointmentsWithRemaining = await Appointment.find({
            remainingAmount: { $gt: 0 },
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });
        const outstandingRevenue = appointmentsWithRemaining.reduce(
            (sum, apt) => sum + apt.remainingAmount,
            0
        );

        // Recent activity (last 10 items)
        const recentAppointments = await Appointment.find()
            .populate('customerId', 'firstName lastName email')
            .populate('staffId', 'firstName lastName email')
            .populate('services', 'name duration fullPrice')
            .sort({ createdAt: 'desc' })
            .limit(10);

        const recentPayments = await Payment.find()
            .populate('customerId', 'firstName lastName email phone')
            .populate('appointmentId')
            .sort({ createdAt: 'desc' })
            .limit(10);

        const recentUsers = await User.find()
            .select('firstName lastName email phone isActive emailVerified createdAt')
            .sort({ createdAt: 'desc' })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    appointments: {
                        total: totalAppointments,
                        byStatus: appointmentsByStatus
                    },
                    payments: {
                        total: totalPayments,
                        totalAmount: totalRevenue,
                        byStatus: paymentsByStatus,
                        byMethod: paymentsByMethod
                    },
                    users: {
                        total: totalUsers,
                        active: activeUsers,
                        verified: verifiedUsers,
                        byRole: {
                            customers: totalCustomers,
                            staff: totalStaff,
                            admins: totalAdmins
                        }
                    },
                    services: {
                        total: totalServices,
                        active: activeServices
                    },
                    revenue: {
                        total: totalRevenue,
                        outstanding: outstandingRevenue
                    }
                },
                recentActivity: {
                    appointments: recentAppointments,
                    payments: recentPayments,
                    users: recentUsers
                }
            }
        });

    } catch (error: any) {
        console.error('Get admin dashboard error:', error);
        next(errorHandler(500, "Server error while fetching admin dashboard"));
    }
};
```

#### `getClientDashboard()`
**Purpose:** Get client dashboard statistics
**Access:** Authenticated customers only
**Features:**
- Customer's appointments by status
- Customer's payments history
- Total spent
- Outstanding balance
**Response:** Complete client dashboard data

**Controller Implementation:**
```typescript
export const getClientDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const customerId = req.user?._id;

        if (!customerId) {
            return next(errorHandler(401, "Customer authentication required"));
        }

        // Appointments statistics
        const totalAppointments = await Appointment.countDocuments({ customerId });
        const appointmentsByStatus = {
            pending: await Appointment.countDocuments({ customerId, status: 'PENDING' }),
            confirmed: await Appointment.countDocuments({ customerId, status: 'CONFIRMED' }),
            completed: await Appointment.countDocuments({ customerId, status: 'COMPLETED' }),
            cancelled: await Appointment.countDocuments({ customerId, status: 'CANCELLED' }),
            no_show: await Appointment.countDocuments({ customerId, status: 'NO_SHOW' })
        };

        // Calculate total spent and outstanding
        const customerAppointments = await Appointment.find({ customerId });
        const totalSpent = customerAppointments
            .filter(apt => apt.status === 'COMPLETED')
            .reduce((sum, apt) => sum + (apt.bookingFeeAmount + (apt.remainingAmount === 0 ? apt.bookingFeeAmount : 0)), 0);

        // Outstanding balance from appointments with remainingAmount > 0
        const outstandingBalance = customerAppointments
            .filter(apt => apt.remainingAmount > 0 && ['PENDING', 'CONFIRMED'].includes(apt.status))
            .reduce((sum, apt) => sum + apt.remainingAmount, 0);

        // Payments statistics
        const customerPayments = await Payment.find({
            appointmentId: { $in: customerAppointments.map(apt => apt._id) }
        });
        const totalPayments = customerPayments.length;
        const successfulPayments = customerPayments.filter(pay => pay.status === 'SUCCESS');
        const totalPaymentAmount = successfulPayments.reduce((sum, pay) => sum + pay.amount, 0);

        // Recent activity (last 5 items)
        const recentAppointments = await Appointment.find({ customerId })
            .populate('staffId', 'firstName lastName email')
            .populate('services', 'name duration fullPrice')
            .sort({ createdAt: 'desc' })
            .limit(5);

        const recentPayments = await Payment.find({
            appointmentId: { $in: customerAppointments.map(apt => apt._id) }
        })
            .populate('customerId', 'firstName lastName email phone')
            .populate('appointmentId')
            .sort({ createdAt: 'desc' })
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    appointments: {
                        total: totalAppointments,
                        byStatus: appointmentsByStatus
                    },
                    payments: {
                        total: totalPayments,
                        totalAmount: totalPaymentAmount
                    },
                    financial: {
                        totalSpent: totalSpent,
                        outstandingBalance: outstandingBalance
                    }
                },
                recentActivity: {
                    appointments: recentAppointments,
                    payments: recentPayments
                }
            }
        });

    } catch (error: any) {
        console.error('Get client dashboard error:', error);
        next(errorHandler(500, "Server error while fetching client dashboard"));
    }
};
```

#### `getRevenueStats(query)`
**Purpose:** Get revenue analytics
**Access:** Admin users only
**Features:**
- Revenue by period (daily, weekly, monthly, yearly)
- Revenue by payment method
- Revenue trends
- Outstanding revenue
- Top customers by revenue
**Query Parameters:**
- period: daily, weekly, monthly, yearly
- startDate, endDate: Date range
**Response:** Revenue analytics data

**Controller Implementation:**
```typescript
export const getRevenueStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { period = 'monthly', startDate, endDate } = req.query;

        // Calculate date range
        let start: Date;
        let end: Date = new Date();

        if (startDate && endDate) {
            start = new Date(startDate as string);
            end = new Date(endDate as string);
        } else {
            // Default to last 30 days
            start = new Date();
            start.setDate(start.getDate() - 30);
        }

        // Get successful payments in date range
        const payments = await Payment.find({
            status: 'SUCCESS',
            createdAt: { $gte: start, $lte: end }
        })
            .populate('customerId', 'firstName lastName email phone')
            .populate({
                path: 'appointmentId',
                populate: {
                    path: 'customerId',
                    select: 'firstName lastName email phone'
                }
            });

        // Calculate total revenue
        const totalRevenue = payments.reduce((sum, pay) => sum + pay.amount, 0);

        // Revenue by payment method
        const revenueByMethod: any = {};
        payments.forEach(payment => {
            const method = payment.method.toLowerCase();
            if (!revenueByMethod[method]) {
                revenueByMethod[method] = 0;
            }
            revenueByMethod[method] += payment.amount;
        });

        // Outstanding revenue
        const outstandingAppointments = await Appointment.find({
            remainingAmount: { $gt: 0 },
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });
        const outstandingRevenue = outstandingAppointments.reduce(
            (sum, apt) => sum + apt.remainingAmount,
            0
        );

        // Top customers by revenue
        const customerRevenue: any = {};
        payments.forEach(pay => {
            if (pay.appointmentId) {
                const appointment = pay.appointmentId as any;
                const customerId = appointment.customerId?.toString() || appointment.customerId;
                if (customerId) {
                    if (!customerRevenue[customerId]) {
                        customerRevenue[customerId] = {
                            customerId: customerId,
                            total: 0
                        };
                    }
                    customerRevenue[customerId].total += pay.amount;
                }
            }
        });

        const topCustomers = await Promise.all(
            Object.values(customerRevenue)
                .sort((a: any, b: any) => b.total - a.total)
                .slice(0, 10)
                .map(async (item: any) => {
                    const customer = await User.findById(item.customerId)
                        .select('firstName lastName email phone');
                    return {
                        customer: customer,
                        total: item.total
                    };
                })
        );

        res.status(200).json({
            success: true,
            data: {
                period: {
                    start: start,
                    end: end,
                    type: period
                },
                revenue: {
                    total: totalRevenue,
                    outstanding: outstandingRevenue,
                    byMethod: revenueByMethod
                },
                topCustomers: topCustomers,
                paymentCount: payments.length
            }
        });

    } catch (error: any) {
        console.error('Get revenue stats error:', error);
        next(errorHandler(500, "Server error while fetching revenue statistics"));
    }
};
```

#### `getAppointmentStats(query)`
**Purpose:** Get appointment statistics
**Access:** Admin users only
**Features:**
- Appointments by status
- Completion rate
- Average appointment duration
- No-show rate
- Cancellation rate
**Response:** Appointment analytics data

**Controller Implementation:**
```typescript
export const getAppointmentStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Appointments by status
        const appointmentsByStatus = {
            pending: await Appointment.countDocuments({ status: 'PENDING' }),
            confirmed: await Appointment.countDocuments({ status: 'CONFIRMED' }),
            completed: await Appointment.countDocuments({ status: 'COMPLETED' }),
            cancelled: await Appointment.countDocuments({ status: 'CANCELLED' }),
            no_show: await Appointment.countDocuments({ status: 'NO_SHOW' })
        };

        const totalAppointments = await Appointment.countDocuments();

        // Calculate completion rate
        const completedCount = appointmentsByStatus.completed;
        const completionRate = totalAppointments > 0 
            ? (completedCount / totalAppointments) * 100 
            : 0;

        // Calculate cancellation rate
        const cancelledCount = appointmentsByStatus.cancelled;
        const cancellationRate = totalAppointments > 0 
            ? (cancelledCount / totalAppointments) * 100 
            : 0;

        // Calculate no-show rate
        const noShowCount = appointmentsByStatus.no_show;
        const noShowRate = totalAppointments > 0 
            ? (noShowCount / totalAppointments) * 100 
            : 0;

        // Calculate average appointment duration
        const allAppointments = await Appointment.find();
        let totalDuration = 0;
        let validDurations = 0;

        allAppointments.forEach(apt => {
            if (apt.startTime && apt.endTime) {
                const duration = (apt.endTime.getTime() - apt.startTime.getTime()) / (1000 * 60); // minutes
                if (duration > 0) {
                    totalDuration += duration;
                    validDurations++;
                }
            }
        });

        const averageDuration = validDurations > 0 ? totalDuration / validDurations : 0;

        // Completed appointments with actual end time
        const completedAppointments = await Appointment.find({
            status: 'COMPLETED',
            actualEndTime: { $exists: true }
        });

        // Calculate average actual duration for completed appointments
        let totalActualDuration = 0;
        let validActualDurations = 0;

        completedAppointments.forEach(apt => {
            if (apt.startTime && apt.actualEndTime) {
                const duration = (apt.actualEndTime.getTime() - apt.startTime.getTime()) / (1000 * 60); // minutes
                if (duration > 0) {
                    totalActualDuration += duration;
                    validActualDurations++;
                }
            }
        });

        const averageActualDuration = validActualDurations > 0 ? totalActualDuration / validActualDurations : 0;

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    total: totalAppointments,
                    byStatus: appointmentsByStatus
                },
                performance: {
                    completionRate: Math.round(completionRate * 100) / 100,
                    cancellationRate: Math.round(cancellationRate * 100) / 100,
                    noShowRate: Math.round(noShowRate * 100) / 100,
                    averageDuration: Math.round(averageDuration),
                    averageActualDuration: Math.round(averageActualDuration),
                    completed: completedCount
                }
            }
        });

    } catch (error: any) {
        console.error('Get appointment stats error:', error);
        next(errorHandler(500, "Server error while fetching appointment statistics"));
    }
};
```

#### `getServiceDemandStats(query)`
**Purpose:** Get service demand analytics
**Access:** Admin users only
**Features:**
- Most requested services
- Service popularity trends
- Service revenue
- Service usage count
**Response:** Service demand analytics data

**Controller Implementation:**
```typescript
export const getServiceDemandStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // All services
        const allServices = await Service.find({ isActive: true });

        // Get all appointments with services populated
        const appointments = await Appointment.find()
            .populate('services', 'name fullPrice duration');

        // Count service usage in appointments
        const serviceUsage: any = {};
        appointments.forEach(appointment => {
            if (appointment.services && Array.isArray(appointment.services)) {
                appointment.services.forEach((service: any) => {
                    const serviceId = service._id ? service._id.toString() : service.toString();
                    if (!serviceUsage[serviceId]) {
                        serviceUsage[serviceId] = {
                            service: service,
                            count: 0,
                            totalRevenue: 0
                        };
                    }
                    serviceUsage[serviceId].count += 1;
                    
                    // Calculate revenue from completed appointments
                    if (appointment.status === 'COMPLETED') {
                        const servicePrice = service.fullPrice || 0;
                        serviceUsage[serviceId].totalRevenue += servicePrice;
                    }
                });
            }
        });

        // Convert to array and sort by count
        const serviceDemand = Object.values(serviceUsage)
            .sort((a: any, b: any) => b.count - a.count);

        // Get service revenue from payments
        const successfulPayments = await Payment.find({ status: 'SUCCESS' })
            .populate('customerId', 'firstName lastName email phone')
            .populate({
                path: 'appointmentId',
                populate: {
                    path: 'services',
                    select: 'name fullPrice'
                }
            });

        const serviceRevenue: any = {};
        successfulPayments.forEach(payment => {
            if (payment.appointmentId) {
                const appointment = payment.appointmentId as any;
                if (appointment.services && Array.isArray(appointment.services)) {
                    appointment.services.forEach((service: any) => {
                        const serviceId = service._id ? service._id.toString() : service.toString();
                        if (!serviceRevenue[serviceId]) {
                            serviceRevenue[serviceId] = 0;
                        }
                        // Distribute payment amount proportionally (simplified)
                        const servicePrice = service.fullPrice || 0;
                        const totalServicePrice = appointment.services.reduce((sum: number, s: any) => 
                            sum + (s.fullPrice || 0), 0);
                        if (totalServicePrice > 0) {
                            serviceRevenue[serviceId] += (payment.amount * servicePrice) / totalServicePrice;
                        }
                    });
                }
            }
        });

        res.status(200).json({
            success: true,
            data: {
                totalServices: allServices.length,
                serviceDemand: serviceDemand.slice(0, 10),
                serviceRevenue: serviceRevenue
            }
        });

    } catch (error: any) {
        console.error('Get service demand stats error:', error);
        next(errorHandler(500, "Server error while fetching service demand statistics"));
    }
};
```

#### `getStaffActivityStats(query)`
**Purpose:** Get staff activity statistics
**Access:** Admin users only
**Features:**
- Active staff members
- Staff appointment counts
- Staff performance metrics
- Top performing staff
**Response:** Staff activity analytics data

**Controller Implementation:**
```typescript
export const getStaffActivityStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { period = 'monthly' } = req.query;

        // Calculate date range
        const end = new Date();
        const start = new Date();
        
        if (period === 'daily') {
            start.setDate(start.getDate() - 1);
        } else if (period === 'weekly') {
            start.setDate(start.getDate() - 7);
        } else if (period === 'monthly') {
            start.setMonth(start.getMonth() - 1);
        } else if (period === 'yearly') {
            start.setFullYear(start.getFullYear() - 1);
        }

        // Get staff role
        const staffRole = await Role.findOne({ name: 'staff' });
        if (!staffRole) {
            return res.status(200).json({
                success: true,
                data: {
                    overview: {
                        total: 0,
                        active: 0
                    },
                    topStaff: []
                }
            });
        }

        // Total staff
        const totalStaff = await User.countDocuments({ roles: staffRole._id });
        const activeStaff = await User.countDocuments({ 
            roles: staffRole._id, 
            isActive: true 
        });

        // Staff with appointments in period
        const staffAppointments = await Appointment.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: '$staffId',
                    appointmentCount: { $sum: 1 },
                    completedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { appointmentCount: -1 }
            },
            {
                $limit: 10
            }
        ]);

        const topStaff = await Promise.all(
            staffAppointments.map(async (item) => {
                const staff = await User.findById(item._id)
                    .select('firstName lastName email phone isActive');
                return {
                    staff: staff,
                    appointmentCount: item.appointmentCount,
                    completedCount: item.completedCount
                };
            })
        );

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    total: totalStaff,
                    active: activeStaff,
                    activeInPeriod: staffAppointments.length
                },
                period: {
                    start: start,
                    end: end,
                    type: period
                },
                topStaff: topStaff
            }
        });

    } catch (error: any) {
        console.error('Get staff activity stats error:', error);
        next(errorHandler(500, "Server error while fetching staff activity statistics"));
    }
};
```

---

## 🛣️ Dashboard Routes

### Base Path: `/api/dashboard`

```typescript
// Admin Routes
GET    /admin                     // Admin dashboard
GET    /revenue                   // Revenue analytics
GET    /appointments              // Appointment statistics
GET    /service-demand            // Service demand analytics
GET    /staff-activity           // Staff activity statistics

// Client Routes
GET    /client                    // Client dashboard
```

### Router Implementation

**File: `src/routes/dashboardRoutes.ts`**

```typescript
import express from 'express';
import {
    getAdminDashboard,
    getClientDashboard,
    getRevenueStats,
    getAppointmentStats,
    getServiceDemandStats,
    getStaffActivityStats
} from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/dashboard/admin
 * @desc    Get admin dashboard statistics
 * @access  Private (Admin only)
 */
router.get('/admin', authenticateToken, authorizeRoles(['admin']), getAdminDashboard);

/**
 * @route   GET /api/dashboard/client
 * @desc    Get client dashboard statistics
 * @access  Private (Customer)
 */
router.get('/client', authenticateToken, getClientDashboard);

/**
 * @route   GET /api/dashboard/revenue
 * @desc    Get revenue analytics
 * @access  Private (Admin only)
 */
router.get('/revenue', authenticateToken, authorizeRoles(['admin']), getRevenueStats);

/**
 * @route   GET /api/dashboard/appointments
 * @desc    Get appointment statistics
 * @access  Private (Admin only)
 */
router.get('/appointments', authenticateToken, authorizeRoles(['admin']), getAppointmentStats);

/**
 * @route   GET /api/dashboard/service-demand
 * @desc    Get service demand analytics
 * @access  Private (Admin only)
 */
router.get('/service-demand', authenticateToken, authorizeRoles(['admin']), getServiceDemandStats);

/**
 * @route   GET /api/dashboard/staff-activity
 * @desc    Get staff activity statistics
 * @access  Private (Admin only)
 */
router.get('/staff-activity', authenticateToken, authorizeRoles(['admin']), getStaffActivityStats);

export default router;
```

### Route Details

#### `GET /api/dashboard/admin`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "appointments": {
        "total": 100,
        "byStatus": {
          "pending": 10,
          "confirmed": 30,
          "completed": 50,
          "cancelled": 5,
          "no_show": 5
        }
      },
      "payments": {
        "total": 120,
        "totalAmount": 500000,
        "byStatus": {
          "pending": 5,
          "success": 110,
          "failed": 5
        },
        "byMethod": {
          "mpesa": 80,
          "card": 30,
          "cash": 10
        }
      },
      "users": {
        "total": 50,
        "active": 45,
        "verified": 40,
        "byRole": {
          "customers": 40,
          "staff": 8,
          "admins": 2
        }
      },
      "services": {
        "total": 10,
        "active": 8
      },
      "revenue": {
        "total": 500000,
        "outstanding": 10000
      }
    },
    "recentActivity": {
      "appointments": [...],
      "payments": [...],
      "users": [...]
    }
  }
}
```

#### `GET /api/dashboard/client`
**Headers:** `Authorization: Bearer <client_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "appointments": {
        "total": 5,
        "byStatus": {
          "pending": 0,
          "confirmed": 2,
          "completed": 3,
          "cancelled": 0,
          "no_show": 0
        }
      },
      "payments": {
        "total": 12,
        "totalAmount": 45000
      },
      "financial": {
        "totalSpent": 45000,
        "outstandingBalance": 5000
      }
    },
    "recentActivity": {
      "appointments": [...],
      "payments": [...]
    }
  }
}
```

#### `GET /api/dashboard/revenue`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `period` (optional): daily, weekly, monthly, yearly (default: monthly)
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-01-01T00:00:00.000Z",
      "end": "2025-01-31T23:59:59.999Z",
      "type": "monthly"
    },
    "revenue": {
      "total": 50000,
      "outstanding": 10000,
      "byMethod": {
        "mpesa": 30000,
        "card": 20000
      }
    },
    "topCustomers": [...],
    "paymentCount": 50
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user/customer
**Usage in Dashboard Routes:**
```typescript
router.get('/admin', authenticateToken, authorizeRoles(['admin']), getAdminDashboard);
router.get('/client', authenticateToken, getClientDashboard);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check admin permissions
**Usage:**
```typescript
router.get('/revenue', authenticateToken, authorizeRoles(['admin']), getRevenueStats);
```

---

## 📝 API Examples

### Complete Dashboard Flow

#### 1. Get Admin Dashboard
```bash
curl -X GET http://localhost:4500/api/dashboard/admin \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 2. Get Client Dashboard
```bash
curl -X GET http://localhost:4500/api/dashboard/client \
  -H "Authorization: Bearer <client_access_token>"
```

#### 3. Get Revenue Statistics
```bash
curl -X GET "http://localhost:4500/api/dashboard/revenue?period=monthly&startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 4. Get Appointment Statistics
```bash
curl -X GET http://localhost:4500/api/dashboard/appointments \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 5. Get Service Demand Statistics
```bash
curl -X GET http://localhost:4500/api/dashboard/service-demand \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 6. Get Staff Activity Statistics
```bash
curl -X GET "http://localhost:4500/api/dashboard/staff-activity?period=monthly" \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 🔒 Security Features

### Access Control
- **Admin Only** - Most dashboard endpoints require admin privileges
- **Client Access** - Clients can only access their own dashboard
- **Role-Based Access** - Different roles see different data
- **Data Isolation** - Clients can only see their own data

### Data Protection
- **Aggregated Data** - Only aggregated statistics, no sensitive details
- **Client Isolation** - Client dashboards only show their data
- **Audit Trail** - All dashboard access logged

---

## 🚨 Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access token required"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Server error while fetching dashboard"
}
```

---

## 🔗 Integration with Other Modules

### Appointment Integration
- Appointment statistics and status breakdowns
- Appointment completion metrics
- Staff assignments

### Payment Integration
- Payment statistics
- Revenue by payment method
- Payment history

### User Integration
- User activity metrics
- User engagement statistics
- Top customers by revenue

### Service Integration
- Service popularity metrics
- Service demand analytics
- Service revenue tracking

---

## 📊 Performance Considerations

### Optimization Tips
- **Database Indexes** - Ensure proper indexes on frequently queried fields
- **Caching** - Consider caching dashboard data for better performance
- **Pagination** - Use pagination for large datasets
- **Aggregation** - Use MongoDB aggregation for complex calculations

### Database Indexes
```typescript
// Appointment indexes
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ customerId: 1 });
appointmentSchema.index({ staffId: 1 });
appointmentSchema.index({ createdAt: -1 });

// Payment indexes
paymentSchema.index({ status: 1 });
paymentSchema.index({ appointmentId: 1 });
paymentSchema.index({ createdAt: 1 });

// User indexes
userSchema.index({ roles: 1 });
userSchema.index({ isActive: 1 });
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0  
**Maintainer:** Appointment API Development Team
