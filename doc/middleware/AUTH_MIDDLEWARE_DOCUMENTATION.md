# 🔐 Appointment API - Authentication and Authorization Middleware Documentation

## 📋 Table of Contents
- [Auth Middleware Overview](#auth-middleware-overview)
- [Implementation Details](#implementation-details)
  - [authenticateToken](#authenticatetoken)
  - [authorizeRoles](#authorizeroles)
  - [requireAdmin](#requireadmin)
  - [requireOwnershipOrAdmin](#requireownershiporadmin)
  - [requireEmailVerification](#requireemailverification)
  - [optionalAuth](#optionalauth)
- [Usage in Routes](#usage-in-routes)
  - [Auth Routes](#auth-routes)
  - [User Routes](#user-routes)
  - [Role Routes](#role-routes)
  - [Service Routes](#service-routes)
  - [Availability Routes](#availability-routes)
  - [Appointment Routes](#appointment-routes)
  - [Break Routes](#break-routes)
  - [Payment Routes](#payment-routes)
  - [Notification Routes](#notification-routes)
  - [Store Configuration Routes](#store-configuration-routes)
  - [Contact Routes](#contact-routes)
  - [Dashboard Routes](#dashboard-routes)
- [Error Handling](#error-handling)
- [Key Environment Variables](#key-environment-variables)
- [Best Practices](#best-practices)

---

## Auth Middleware Overview

The authentication and authorization middleware layer (`src/middleware/auth.ts`) is central to securing the Appointment API. It provides a set of functions that:

-   Verify JSON Web Tokens (JWTs).
-   Attach authenticated user information to the request object.
-   Enforce role-based access control (RBAC).
-   Handle resource ownership checks.
-   Require email verification for specific actions.
-   Allow optional authentication for public endpoints with user context.

This ensures that only authorized users can access protected resources and perform permitted actions.

---

## Implementation Details

The `src/middleware/auth.ts` file contains the implementation of all authentication and authorization middleware functions.

### `authenticateToken`

Verifies the JWT provided in the `Authorization` header. If valid, it decodes the token, fetches the corresponding user from the database, populates their roles, and attaches the user object (with `roleNames`) to `req.user`.

**File: `src/middleware/auth.ts` - `authenticateToken` snippet**
```typescript
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { errorHandler } from "./errorHandler";
import type { IUserResponse } from "../types/index";

declare global {
  namespace Express {
    interface Request {
      user?: IUserResponse;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next(errorHandler(401, "Access token required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await User.findById(decoded.userId).populate("roles", "name displayName");

    if (!user) {
      return next(errorHandler(401, "User not found"));
    }

    if (!user.isActive) {
      return next(errorHandler(401, "User account is deactivated"));
    }

    const roleNames = user.roles && Array.isArray(user.roles)
      ? user.roles.map((role: any) => role.name || role)
      : [];

    req.user = {
      ...user.toObject(),
      roleNames
    } as IUserResponse;

    next();
  } catch (error: any) {
    if (error.name === "JsonWebTokenError") {
      return next(errorHandler(401, "Invalid token"));
    }
    if (error.name === "TokenExpiredError") {
      return next(errorHandler(401, "Token expired"));
    }
    return next(errorHandler(500, "Authentication error"));
  }
};
```

### `authorizeRoles`

A higher-order function that returns middleware to check if the authenticated user has any of the specified roles.

**File: `src/middleware/auth.ts` - `authorizeRoles` snippet**
```typescript
export const authorizeRoles = (allowedRoles: string[] = []) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next(errorHandler(401, "Authentication required"));
      }

      const userRoleNames = req.user.roleNames || [];
      const hasAllowedRole = allowedRoles.some((role) => userRoleNames.includes(role));

      if (!hasAllowedRole) {
        return next(errorHandler(403, "Insufficient permissions"));
      }

      next();
    } catch (error: any) {
      return next(errorHandler(500, "Authorization error"));
    }
  };
};
```

### `requireAdmin`

Middleware that specifically checks if the authenticated user has the "admin" role.

**File: `src/middleware/auth.ts` - `requireAdmin` snippet**
```typescript
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      return next(errorHandler(401, "Authentication required"));
    }

    const userRoleNames = req.user.roleNames || [];
    if (!userRoleNames.includes("admin")) {
      return next(errorHandler(403, "Admin access required"));
    }

    next();
  } catch (error: any) {
    return next(errorHandler(500, "Authorization error"));
  }
};
```

### `requireOwnershipOrAdmin`

A higher-order function that returns middleware to check if the authenticated user is either an "admin" or the owner of the resource specified by `resourceUserIdField`.

**File: `src/middleware/auth.ts` - `requireOwnershipOrAdmin` snippet**
```typescript
export const requireOwnershipOrAdmin = (resourceUserIdField: string = "userId") => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next(errorHandler(401, "Authentication required"));
      }

      const userRoleNames = req.user.roleNames || [];
      if (userRoleNames.includes("admin")) {
        return next();
      }

      const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
      if (!resourceUserId) {
        return next(errorHandler(400, "Resource user ID not found"));
      }

      if (req.user._id.toString() !== resourceUserId.toString()) {
        return next(errorHandler(403, "Access denied"));
      }

      next();
    } catch (error: any) {
      return next(errorHandler(500, "Authorization error"));
    }
  };
};
```

### `requireEmailVerification`

Middleware that checks if the authenticated user's email is verified.

**File: `src/middleware/auth.ts` - `requireEmailVerification` snippet**
```typescript
export const requireEmailVerification = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      return next(errorHandler(401, "Authentication required"));
    }

    if (!req.user.emailVerified) {
      return next(errorHandler(403, "Email verification required"));
    }

    next();
  } catch (error: any) {
    return next(errorHandler(500, "Verification error"));
  }
};
```

### `optionalAuth`

Attempts to authenticate a user if a token is present, but allows the request to proceed even if no token is provided or the token is invalid. If authentication is successful, `req.user` will be populated.

**File: `src/middleware/auth.ts` - `optionalAuth` snippet**
```typescript
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next(); // No token, proceed without authentication
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await User.findById(decoded.userId).populate("roles", "name displayName");

    if (user && user.isActive) {
      const roleNames = user.roles && Array.isArray(user.roles)
        ? user.roles.map((role: any) => role.name || role)
        : [];
      req.user = {
        ...user.toObject(),
        roleNames
      } as IUserResponse;
    }

    next();
  } catch (_error: any) {
    next(); // Invalid token, proceed without authentication but don't set req.user
  }
};
```

---

## Usage in Routes

Authentication and authorization middlewares are applied to routes in the `src/routes` directory to protect endpoints based on various access requirements.

### Auth Routes (`src/routes/authRoutes.ts`)

```typescript
import { authenticateToken } from "../middleware/auth";

// ...
router.post("/logout", authenticateToken, logout);
router.get("/me", authenticateToken, getMe);
```

### User Routes (`src/routes/userRoutes.ts`)

```typescript
import { authenticateToken, authorizeRoles, requireAdmin } from "../middleware/auth";

// ...
router.get("/profile", authenticateToken, getUserProfile);
router.put("/profile", authenticateToken, uploadUserAvatar.single("avatar"), updateUserProfile);
router.put("/change-password", authenticateToken, changePassword);
router.get("/notifications", authenticateToken, getNotificationPreferences);
router.put("/notifications", authenticateToken, updateNotificationPreferences);
router.post("/admin-create", authenticateToken, authorizeRoles(["admin"]), adminCreateCustomer);
router.get("/customers", authenticateToken, authorizeRoles(["admin"]), getCustomers);
router.get("/", authenticateToken, authorizeRoles(["admin"]), getAllUsers);
router.get("/:userId", authenticateToken, authorizeRoles(["admin"]), getUserById);
router.put("/:userId", authenticateToken, authorizeRoles(["admin"]), uploadUserAvatar.single("avatar"), updateUser);
router.put("/:userId/status", authenticateToken, authorizeRoles(["admin"]), updateUserStatus);
router.put("/:userId/admin", authenticateToken, requireAdmin, setUserAdmin); // Example using requireAdmin
router.get("/:userId/roles", authenticateToken, authorizeRoles(["admin"]), getUserRoles);
router.delete("/:userId", authenticateToken, requireAdmin, deleteUser);
router.post("/:userId/roles", authenticateToken, requireAdmin, assignRole);
router.delete("/:userId/roles/:roleId", authenticateToken, requireAdmin, removeRole);
```

### Role Routes (`src/routes/roleRoutes.ts`)

```typescript
import { authenticateToken, authorizeRoles, requireAdmin } from "../middleware/auth";

// ...
router.get("/", authenticateToken, authorizeRoles(["admin"]), getAllRoles);
router.get("/:roleId", authenticateToken, authorizeRoles(["admin"]), getRole);
router.post("/", authenticateToken, requireAdmin, createRole);
router.put("/:roleId", authenticateToken, requireAdmin, updateRole);
router.delete("/:roleId", authenticateToken, requireAdmin, deleteRole);
router.get("/:roleId/users", authenticateToken, authorizeRoles(["admin"]), getUsersByRole);
router.get("/customer/users", authenticateToken, authorizeRoles(["admin"]), getCustomers);
```

### Service Routes (`src/routes/serviceRoutes.ts`)

```typescript
import { authenticateToken, requireAdmin } from "../middleware/auth";

// ...
router.post("/", authenticateToken, requireAdmin, createService);
router.put("/:serviceId", authenticateToken, requireAdmin, updateService);
router.delete("/:serviceId", authenticateToken, requireAdmin, deleteService);
router.patch("/:serviceId/toggle-status", authenticateToken, requireAdmin, toggleServiceStatus);
router.post("/assign/:userId", authenticateToken, requireAdmin, assignServicesToStaff);
```

### Availability Routes (`src/routes/availabilityRoutes.ts`)

*(Note: Currently, Availability routes are public and do not use authentication middleware directly.)*

```typescript
// No authentication middleware used directly in current availability routes
router.get("/slots", getAvailableSlots);
router.get("/day", getDayAvailability);
```

### Appointment Routes (`src/routes/appointmentRoutes.ts`)

```typescript
import { authenticateToken, authorizeRoles } from "../middleware/auth";

// ...
router.post("/", authenticateToken, authorizeRoles(["customer", "admin"]), createAppointment);
router.post("/:appointmentId/confirm", authenticateToken, authorizeRoles(["customer", "admin"]), confirmAppointment); // Corrected roles based on usage
router.patch("/:appointmentId/reschedule", authenticateToken, authorizeRoles(["admin", "staff", "customer"]), rescheduleAppointment);
router.patch("/:appointmentId/cancel", authenticateToken, authorizeRoles(["admin", "staff", "customer"]), cancelAppointment);
router.patch("/:appointmentId/check-in", authenticateToken, authorizeRoles(["staff", "admin"]), checkIn);
router.patch("/:appointmentId/complete", authenticateToken, authorizeRoles(["staff", "admin"]), completeAppointment);
router.patch("/:appointmentId/no-show", authenticateToken, authorizeRoles(["staff", "admin"]), markNoShow);
router.get("/", authenticateToken, authorizeRoles(["admin", "staff"]), getAppointments);
router.get("/my", authenticateToken, getMyAppointments);
router.get("/:appointmentId", authenticateToken, getAppointmentById);
router.delete("/:appointmentId", authenticateToken, authorizeRoles(["admin", "staff"]), deleteAppointment);
```

### Break Routes (`src/routes/breakRoutes.ts`)

```typescript
import { authenticateToken, requireAdmin } from "../middleware/auth";

// ...
router.get("/", authenticateToken, requireAdmin, getBreaks);
router.get("/:breakId", authenticateToken, requireAdmin, getBreak);
router.post("/", authenticateToken, requireAdmin, createBreak);
router.put("/:breakId", authenticateToken, requireAdmin, updateBreak);
router.delete("/:breakId", authenticateToken, requireAdmin, deleteBreak);
```

### Payment Routes (`src/routes/paymentRoutes.ts`)

```typescript
import { authenticateToken, authorizeRoles } from "../middleware/auth";

// ...
router.post("/initiate", authenticateToken, initiatePayment);
router.post("/service-payment", authenticateToken, servicePayment);
router.get("/", authenticateToken, authorizeRoles(["admin", "staff"]), getPayments);
router.get("/status/:checkoutRequestId", authenticateToken, checkPaymentStatus);
router.get("/:paymentId", authenticateToken, getPayment);
```

### Notification Routes (`src/routes/notificationRoutes.ts`)

```typescript
import { authenticateToken, authorizeRoles } from "../middleware/auth";

// ...
router.post("/", authenticateToken, authorizeRoles(["admin", "staff"]), sendNotification);
router.get("/", authenticateToken, getUserNotifications);
router.get("/unread-count", authenticateToken, getUnreadCount);
router.get("/unread", authenticateToken, getUnreadNotifications);
router.get("/category/:category", authenticateToken, getNotificationsByCategory);
router.get("/:notificationId", authenticateToken, getNotification);
router.patch("/:notificationId/read", authenticateToken, markAsRead);
router.patch("/read-all", authenticateToken, markAllAsRead);
router.delete("/:notificationId", authenticateToken, deleteNotification);
router.post("/bulk", authenticateToken, authorizeRoles(["admin"]), sendBulkNotification);
```

### Store Configuration Routes (`src/routes/storeConfigurationRoutes.ts`)

```typescript
import { authenticateToken, requireAdmin } from "../middleware/auth";

// ...
router.put("/", authenticateToken, requireAdmin, updateStoreConfiguration);
```

### Contact Routes (`src/routes/contactRoutes.ts`)

```typescript
import { authenticateToken, requireAdmin, optionalAuth } from "../middleware/auth";

// ...
router.post("/", optionalAuth, submitContact); // Example using optionalAuth
router.get("/", authenticateToken, requireAdmin, getContacts);
router.get("/:contactId", authenticateToken, requireAdmin, getContact);
router.post("/:contactId/reply", authenticateToken, requireAdmin, replyToContact);
router.patch("/:contactId/status", authenticateToken, requireAdmin, updateContactStatus);
```

### Dashboard Routes (`src/routes/dashboardRoutes.ts`)

```typescript
import { authenticateToken, authorizeRoles } from '../middleware/auth';

// ...
router.get('/admin', authenticateToken, authorizeRoles(['admin']), getAdminDashboard);
router.get('/client', authenticateToken, getClientDashboard);
router.get('/revenue', authenticateToken, authorizeRoles(['admin']), getRevenueStats);
router.get('/appointments', authenticateToken, authorizeRoles(['admin']), getAppointmentStats);
router.get('/service-demand', authenticateToken, authorizeRoles(['admin']), getServiceDemandStats);
router.get('/staff-activity', authenticateToken, authorizeRoles(['admin']), getStaffActivityStats);
```

---

## Error Handling

All authentication and authorization middleware functions are designed to integrate with the centralized error handling system. If an authentication or authorization check fails, they use `next(errorHandler(statusCode, message))` to forward a standardized error object to the global error handling middleware (`src/index.ts`). This ensures consistent error responses to the client.

---

## Key Environment Variables

-   `JWT_SECRET`: Secret key used for signing and verifying JWT access tokens.
-   `JWT_REFRESH_SECRET`: Secret key used for signing and verifying JWT refresh tokens.

---

## Best Practices

-   **Layered Security:** Combine `authenticateToken` with `authorizeRoles` or `requireAdmin` for comprehensive access control.
-   **Least Privilege:** Grant users only the minimum necessary permissions.
-   **Ownership Checks:** Use `requireOwnershipOrAdmin` for endpoints where users should only manage their own resources (or if they are an admin).
-   **Email Verification:** Utilize `requireEmailVerification` for critical actions that require a verified user.
-   **Refresh Token Security:** Protect refresh tokens as they grant long-term access.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** Appointment API Development Team
