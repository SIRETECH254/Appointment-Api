# 📧 Appointment API - Newsletter Management Documentation

## 📋 Table of Contents
- [Newsletter Management Overview](#newsletter-management-overview)
- [Newsletter Model](#-newsletter-model)
- [Newsletter Controller](#-newsletter-controller)
- [Newsletter Routes](#-newsletter-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Newsletter Management Overview

Newsletter Management allows users to subscribe to email newsletters. Subscriptions are accepted from **both authenticated and non-authenticated** users. When a user is logged in and sends a token, their `userId` is attached to the subscription for reference. Subscribers can unsubscribe using a unique token or their email address. Admins can manage subscribers, send newsletters, and view subscription statistics.

### Newsletter Features
- **Public Subscription** - Anyone can subscribe with email (only `email` is required)
- **Registered User Subscription** - Registered users can subscribe by including their authentication token; their `userId` will be attached to the subscription
- **User Linking** - If authenticated, userId is attached to subscription
- **Unsubscribe** - Via unique token or email address
- **Re-subscription** - Previously unsubscribed users can re-subscribe
- **Admin Management** - Full CRUD operations for subscribers
- **Newsletter Sending** - Admin can send newsletters to filtered subscribers
- **Statistics** - Subscription metrics for admin dashboard
- **Status Management** - SUBSCRIBED, UNSUBSCRIBED, BOUNCED states
- **Source Tracking** - Track where subscriptions came from (WEBSITE, ADMIN, API, IMPORT)

---

## 📧 Newsletter Model

### Schema Definition
```typescript
interface INewsletter {
  _id: string;
  email: string;
  userId?: string | null;  // set when subscriber is authenticated
  status: "SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED";
  subscribedAt: Date;
  unsubscribedAt?: Date;
  unsubscribeToken?: string;
  source: "WEBSITE" | "ADMIN" | "API" | "IMPORT";
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Newsletter.ts`**

```typescript
import mongoose, { Schema } from "mongoose";
import type { INewsletter } from "../types/index";

const newsletterSchema = new Schema<INewsletter>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
      validate: {
        validator: function(v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please provide a valid email address"
      }
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    status: {
      type: String,
      enum: ["SUBSCRIBED", "UNSUBSCRIBED", "BOUNCED"],
      default: "SUBSCRIBED"
    },
    subscribedAt: {
      type: Date,
      default: Date.now
    },
    unsubscribedAt: {
      type: Date
    },
    unsubscribeToken: {
      type: String,
      unique: true,
      sparse: true
    },
    source: {
      type: String,
      enum: ["WEBSITE", "ADMIN", "API", "IMPORT"],
      default: "WEBSITE"
    },
    tags: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

newsletterSchema.index({ email: 1 });
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ subscribedAt: -1 });
newsletterSchema.index({ userId: 1 }, { sparse: true });
newsletterSchema.index({ unsubscribeToken: 1 }, { sparse: true });

const Newsletter = mongoose.model<INewsletter>("Newsletter", newsletterSchema);

export default Newsletter;
```

### Validation Rules
```typescript
email:            { required: true, unique: true, maxlength: 254, email format }
userId:           { optional, ref User }
status:           { default: "SUBSCRIBED", enum: SUBSCRIBED | UNSUBSCRIBED | BOUNCED }
subscribedAt:     { default: Date.now }
unsubscribedAt:   { optional }
unsubscribeToken: { optional, unique, sparse }
source:           { default: "WEBSITE", enum: WEBSITE | ADMIN | API | IMPORT }
tags:             { optional, array of strings }
```

---

## 🎮 Newsletter Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Newsletter from "../models/Newsletter";
import User from "../models/User";
import { sendGenericEmail } from "../services/external/emailService";
import crypto from "crypto";
```

### Functions Overview

#### `subscribeNewsletter()`
**Purpose:** Subscribe to newsletter (public subscription)  
**Access:** Public (no auth required); optional auth attaches `userId`  
**Validation:** `email` required, valid email format  
**Process:** If email already exists and is SUBSCRIBED, return error. If exists but UNSUBSCRIBED, re-subscribe. If `req.user` exists (after optionalAuth), set `userId`. Generate unique `unsubscribeToken`. Create or update subscription, return 201.  
**Response:** Created/updated subscription

**Controller Implementation:**
```typescript
export const subscribeNewsletter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return next(errorHandler(400, "Valid email is required"));
    }

    const userId = req.user?._id ?? null;
    
    // Check if already subscribed
    let subscriber = await Newsletter.findOne({ email: trimmedEmail });
    
    if (subscriber) {
      if (subscriber.status === "SUBSCRIBED") {
        return next(errorHandler(400, "Email is already subscribed"));
      }
      // Re-subscribe if previously unsubscribed
      subscriber.status = "SUBSCRIBED";
      subscriber.subscribedAt = new Date();
      subscriber.unsubscribedAt = undefined;
      subscriber.unsubscribeToken = crypto.randomBytes(32).toString("hex");
      if (userId) subscriber.userId = userId;
      await subscriber.save();
    } else {
      // Create new subscription
      subscriber = new Newsletter({
        email: trimmedEmail,
        userId: userId || undefined,
        status: "SUBSCRIBED",
        unsubscribeToken: crypto.randomBytes(32).toString("hex"),
        source: userId ? "API" : "WEBSITE"
      });
      await subscriber.save();
    }

    res.status(201).json({
      success: true,
      message: "Successfully subscribed to newsletter",
      data: { subscriber }
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return next(errorHandler(400, "Email is already subscribed"));
    }
    console.error("Subscribe newsletter error:", error);
    next(errorHandler(500, "Server error while subscribing to newsletter"));
  }
};
```

#### `unsubscribeNewsletter()`
**Purpose:** Unsubscribe from newsletter  
**Access:** Public (no auth required)  
**Validation:** `token` or `email` query parameter required  
**Process:** Find subscriber by token or email. If not found, return 404. If already UNSUBSCRIBED, return success. Update status to UNSUBSCRIBED, set `unsubscribedAt` timestamp.  
**Response:** Success message

**Controller Implementation:**
```typescript
export const unsubscribeNewsletter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, email } = req.query;
    
    let subscriber;
    
    if (token && typeof token === "string") {
      subscriber = await Newsletter.findOne({ unsubscribeToken: token });
    } else if (email && typeof email === "string") {
      subscriber = await Newsletter.findOne({ email: email.trim().toLowerCase() });
    } else {
      return next(errorHandler(400, "Token or email is required"));
    }

    if (!subscriber) {
      return next(errorHandler(404, "Subscriber not found"));
    }

    if (subscriber.status === "UNSUBSCRIBED") {
      return res.status(200).json({
        success: true,
        message: "Already unsubscribed"
      });
    }

    subscriber.status = "UNSUBSCRIBED";
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    res.status(200).json({
      success: true,
      message: "Successfully unsubscribed from newsletter"
    });
  } catch (error: any) {
    console.error("Unsubscribe newsletter error:", error);
    next(errorHandler(500, "Server error while unsubscribing"));
  }
};
```

#### `getSubscribers(query)`
**Purpose:** List newsletter subscribers  
**Access:** Admin  
**Validation:** Optional query filters only  
**Process:** Filter by `status`, optional `search` (email only), sort by `subscribedAt` or other fields  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Response:** Subscriber list with pagination

**Controller Implementation:**
```typescript
export const getSubscribers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search, page = 1, limit = 10, sort = "subscribedAt:desc" } = req.query;
    const query: any = {};

    if (status === "SUBSCRIBED" || status === "UNSUBSCRIBED" || status === "BOUNCED") {
      query.status = status;
    }

    if (search && typeof search === "string" && search.trim().length > 0) {
      const term = search.trim();
      query.$or = [
        { email: { $regex: term, $options: "i" } }
      ];
    }

    let sortOptions: Record<string, 1 | -1> = { subscribedAt: -1 };
    if (typeof sort === "string") {
      const [field, order] = sort.split(":");
      if (field && (order === "asc" || order === "desc")) {
        sortOptions = { [field]: order === "asc" ? 1 : -1 };
      }
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    const subscribers = await Newsletter.find(query)
      .sort(sortOptions)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit)
      .populate("userId", "firstName lastName email");

    const total = await Newsletter.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        subscribers,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalSubscribers: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get subscribers error:", error);
    next(errorHandler(500, "Server error while fetching subscribers"));
  }
};
```

#### `getSubscriber(subscriberId)`
**Purpose:** Fetch a subscriber by id  
**Access:** Admin  
**Validation:** Subscriber must exist  
**Process:** Find by id, populate userId  
**Response:** Subscriber record

**Controller Implementation:**
```typescript
export const getSubscriber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subscriberId } = req.params;
    const subscriber = await Newsletter.findById(subscriberId).populate("userId", "firstName lastName email");

    if (!subscriber) {
      return next(errorHandler(404, "Subscriber not found"));
    }

    res.status(200).json({
      success: true,
      data: { subscriber }
    });
  } catch (error: any) {
    console.error("Get subscriber error:", error);
    next(errorHandler(500, "Server error while fetching subscriber"));
  }
};
```

#### `updateSubscriberStatus(subscriberId, { status })`
**Purpose:** Update subscriber status (e.g. mark as SUBSCRIBED, UNSUBSCRIBED, BOUNCED)  
**Access:** Admin  
**Validation:** Subscriber must exist; `status` must be SUBSCRIBED, UNSUBSCRIBED, or BOUNCED  
**Process:** Update status, set appropriate timestamps (subscribedAt/unsubscribedAt)  
**Response:** Updated subscriber

**Controller Implementation:**
```typescript
export const updateSubscriberStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subscriberId } = req.params;
    const { status } = req.body;

    const allowed: ("SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED")[] = ["SUBSCRIBED", "UNSUBSCRIBED", "BOUNCED"];
    if (!status || typeof status !== "string" || !allowed.includes(status as any)) {
      return next(errorHandler(400, "status must be one of: SUBSCRIBED, UNSUBSCRIBED, BOUNCED"));
    }

    const subscriber = await Newsletter.findById(subscriberId);
    if (!subscriber) {
      return next(errorHandler(404, "Subscriber not found"));
    }

    subscriber.status = status as "SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED";
    if (status === "UNSUBSCRIBED" && !subscriber.unsubscribedAt) {
      subscriber.unsubscribedAt = new Date();
    } else if (status === "SUBSCRIBED") {
      subscriber.subscribedAt = new Date();
      subscriber.unsubscribedAt = undefined;
    }

    await subscriber.save();

    res.status(200).json({
      success: true,
      message: "Subscriber status updated successfully",
      data: { subscriber }
    });
  } catch (error: any) {
    console.error("Update subscriber status error:", error);
    next(errorHandler(500, "Server error while updating subscriber status"));
  }
};
```

#### `deleteSubscriber(subscriberId)`
**Purpose:** Delete a subscriber  
**Access:** Admin  
**Validation:** Subscriber must exist  
**Process:** Delete by id  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteSubscriber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subscriberId } = req.params;
    const subscriber = await Newsletter.findById(subscriberId);

    if (!subscriber) {
      return next(errorHandler(404, "Subscriber not found"));
    }

    await Newsletter.findByIdAndDelete(subscriberId);

    res.status(200).json({
      success: true,
      message: "Subscriber deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete subscriber error:", error);
    next(errorHandler(500, "Server error while deleting subscriber"));
  }
};
```

#### `sendNewsletter({ subject, message, status })`
**Purpose:** Send newsletter email to subscribers  
**Access:** Admin  
**Validation:** `subject` and `message` required; `status` optional (default: SUBSCRIBED)  
**Process:** Find subscribers by status (default: SUBSCRIBED). Send email to each subscriber using `sendGenericEmail`. Handle errors gracefully (don't fail entire batch).  
**Response:** Success with count of emails sent

**Controller Implementation:**
```typescript
export const sendNewsletter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subject, message, status = "SUBSCRIBED" } = req.body;

    const trimmedSubject = typeof subject === "string" ? subject.trim() : "";
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    if (!trimmedSubject || !trimmedMessage) {
      return next(errorHandler(400, "Subject and message are required"));
    }

    const subscribers = await Newsletter.find({ status });
    
    if (subscribers.length === 0) {
      return next(errorHandler(400, "No subscribers found with the specified status"));
    }

    // Send emails (in production, consider using a queue system)
    const emailPromises = subscribers.map(subscriber => 
      sendGenericEmail(subscriber.email, trimmedSubject, trimmedMessage)
        .catch(err => {
          console.error(`Failed to send email to ${subscriber.email}:`, err);
          // Optionally mark as BOUNCED
          return null;
        })
    );

    await Promise.allSettled(emailPromises);

    res.status(200).json({
      success: true,
      message: `Newsletter sent to ${subscribers.length} subscribers`,
      data: { sentCount: subscribers.length }
    });
  } catch (error: any) {
    console.error("Send newsletter error:", error);
    next(errorHandler(500, "Server error while sending newsletter"));
  }
};
```

#### `getSubscriptionStats()`
**Purpose:** Get newsletter subscription statistics  
**Access:** Admin  
**Validation:** None  
**Process:** Count total subscribers, count by status (SUBSCRIBED, UNSUBSCRIBED, BOUNCED), count recent subscriptions (last 30 days)  
**Response:** Statistics object

**Controller Implementation:**
```typescript
export const getSubscriptionStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const total = await Newsletter.countDocuments();
    const subscribed = await Newsletter.countDocuments({ status: "SUBSCRIBED" });
    const unsubscribed = await Newsletter.countDocuments({ status: "UNSUBSCRIBED" });
    const bounced = await Newsletter.countDocuments({ status: "BOUNCED" });

    // Recent subscriptions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSubscriptions = await Newsletter.countDocuments({
      status: "SUBSCRIBED",
      subscribedAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        subscribed,
        unsubscribed,
        bounced,
        recentSubscriptions
      }
    });
  } catch (error: any) {
    console.error("Get subscription stats error:", error);
    next(errorHandler(500, "Server error while fetching subscription stats"));
  }
};
```

---

## 🛣️ Newsletter Routes

### Base Path: `/api/newsletter`

```typescript
POST   /subscribe              // Subscribe to newsletter (public; optionalAuth to attach user)
GET    /unsubscribe            // Unsubscribe from newsletter (public; token or email)
GET    /                       // List subscribers (admin)
GET    /stats                  // Get subscription statistics (admin)
GET    /:subscriberId          // Get subscriber by id (admin)
PATCH  /:subscriberId/status  // Update subscriber status (admin)
DELETE /:subscriberId         // Delete subscriber (admin)
POST   /send                  // Send newsletter to subscribers (admin)
```

### Router Implementation

**File: `src/routes/newsletterRoutes.ts`**

```typescript
/**
 * @swagger
 * tags:
 *   name: Newsletter
 *   description: Newsletter subscription management
 */

import express from "express";
import {
  subscribeNewsletter,
  unsubscribeNewsletter,
  getSubscribers,
  getSubscriber,
  updateSubscriberStatus,
  deleteSubscriber,
  sendNewsletter,
  getSubscriptionStats
} from "../controllers/newsletterController";
import { authenticateToken, requireAdmin, optionalAuth } from "../middleware/auth";

const router = express.Router();

// Public routes
router.post("/subscribe", optionalAuth, subscribeNewsletter);
router.get("/unsubscribe", unsubscribeNewsletter);

// Admin routes
router.get("/", authenticateToken, requireAdmin, getSubscribers);
router.get("/stats", authenticateToken, requireAdmin, getSubscriptionStats);
router.get("/:subscriberId", authenticateToken, requireAdmin, getSubscriber);
router.patch("/:subscriberId/status", authenticateToken, requireAdmin, updateSubscriberStatus);
router.delete("/:subscriberId", authenticateToken, requireAdmin, deleteSubscriber);
router.post("/send", authenticateToken, requireAdmin, sendNewsletter);

export default router;
```

### Route Details

#### `POST /api/newsletter/subscribe`
**Headers (optional):** `Authorization: Bearer <token>` — if present, `userId` is attached to the subscription (registered users can subscribe with their token)  
**Body:**
```json
{
  "email": "name@example.com"
}
```
**Note:** Only `email` is required. Registered users can subscribe by including their authentication token in the headers.
**Response:**
```json
{
  "success": true,
  "message": "Successfully subscribed to newsletter",
  "data": {
    "subscriber": {
      "_id": "...",
      "email": "name@example.com",
      "status": "SUBSCRIBED",
      "subscribedAt": "...",
      "unsubscribeToken": "...",
      "source": "WEBSITE",
      "createdAt": "..."
    }
  }
}
```
**Note:** If a registered user subscribes with an authentication token, the `userId` field will be populated and `source` will be "API".

#### `GET /api/newsletter/unsubscribe`
**Query Parameters:** `token=<unsubscribe_token>` OR `email=<email_address>`  
**Response:**
```json
{
  "success": true,
  "message": "Successfully unsubscribed from newsletter"
}
```

#### `GET /api/newsletter`
**Headers:** `Authorization: Bearer <admin_token>`  
**Query (optional):** `status=SUBSCRIBED|UNSUBSCRIBED|BOUNCED`, `search=<term>`, `sort=subscribedAt:asc|desc`, `page`, `limit`  
**Response:**
```json
{
  "success": true,
  "data": {
    "subscribers": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalSubscribers": 0,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/newsletter/stats`
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "subscribed": 85,
    "unsubscribed": 10,
    "bounced": 5,
    "recentSubscriptions": 15
  }
}
```

#### `GET /api/newsletter/:subscriberId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:**
```json
{
  "success": true,
  "data": {
    "subscriber": {}
  }
}
```

#### `PATCH /api/newsletter/:subscriberId/status`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "status": "UNSUBSCRIBED"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Subscriber status updated successfully",
  "data": {
    "subscriber": {}
  }
}
```

#### `DELETE /api/newsletter/:subscriberId`
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:**
```json
{
  "success": true,
  "message": "Subscriber deleted successfully"
}
```

#### `POST /api/newsletter/send`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "subject": "Monthly Newsletter",
  "message": "This is the newsletter content...",
  "status": "SUBSCRIBED"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Newsletter sent to 85 subscribers",
  "data": {
    "sentCount": 85
  }
}
```

---

## 🔐 Middleware

### optionalAuth
**Purpose:** Attach user to request if a valid JWT is sent; do not require auth.  
**Usage:** Used on `POST /api/newsletter/subscribe` so authenticated users get their `userId` stored with the subscription.
```typescript
router.post("/subscribe", optionalAuth, subscribeNewsletter);
```

### authenticateToken
**Purpose:** Verify JWT for protected routes.  
**Usage:** Admin newsletter routes.
```typescript
router.get("/", authenticateToken, requireAdmin, getSubscribers);
```

### requireAdmin
**Purpose:** Restrict access to admin role.  
**Usage:** List, get one, update status, delete, send newsletter, and get statistics.
```typescript
router.get("/:subscriberId", authenticateToken, requireAdmin, getSubscriber);
router.patch("/:subscriberId/status", authenticateToken, requireAdmin, updateSubscriberStatus);
router.delete("/:subscriberId", authenticateToken, requireAdmin, deleteSubscriber);
router.post("/send", authenticateToken, requireAdmin, sendNewsletter);
router.get("/stats", authenticateToken, requireAdmin, getSubscriptionStats);
```

---

## 📝 API Examples

### Subscribe to Newsletter (public — no auth required)
Only `email` is required:
```bash
curl -X POST http://localhost:4500/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "email": "name@example.com"
  }'
```

### Subscribe to Newsletter (registered users — with auth token)
Registered users can subscribe by including their authentication token. Their `userId` will be attached to the subscription:
```bash
curl -X POST http://localhost:4500/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "email": "name@example.com"
  }'
```


### Unsubscribe from Newsletter (by token)
```bash
curl -X GET "http://localhost:4500/api/newsletter/unsubscribe?token=<unsubscribe_token>"
```

### Unsubscribe from Newsletter (by email)
```bash
curl -X GET "http://localhost:4500/api/newsletter/unsubscribe?email=jane@example.com"
```

### List Subscribers (admin)
```bash
curl -X GET "http://localhost:4500/api/newsletter?status=SUBSCRIBED&sort=subscribedAt:desc" \
  -H "Authorization: Bearer <admin_token>"
```

### Get Subscription Statistics (admin)
```bash
curl -X GET http://localhost:4500/api/newsletter/stats \
  -H "Authorization: Bearer <admin_token>"
```

### Get Subscriber by ID (admin)
```bash
curl -X GET http://localhost:4500/api/newsletter/<subscriberId> \
  -H "Authorization: Bearer <admin_token>"
```

### Update Subscriber Status (admin)
```bash
curl -X PATCH http://localhost:4500/api/newsletter/<subscriberId>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"status": "UNSUBSCRIBED"}'
```

### Delete Subscriber (admin)
```bash
curl -X DELETE http://localhost:4500/api/newsletter/<subscriberId> \
  -H "Authorization: Bearer <admin_token>"
```

### Send Newsletter (admin)
```bash
curl -X POST http://localhost:4500/api/newsletter/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "subject": "Monthly Newsletter",
    "message": "This is the newsletter content...",
    "status": "SUBSCRIBED"
  }'
```

---

## 🛡️ Security Features

- **Public subscription:** No auth required; anyone can subscribe. Consider rate limiting on `POST /api/newsletter/subscribe` (e.g. same as auth endpoints).
- **Optional auth:** If token is sent, `userId` is attached for admin reference.
- **Unsubscribe security:** Unique token generated using crypto.randomBytes for secure unsubscribe links.
- **Admin-only management:** List, get one, update status, delete, send newsletter, and get statistics require `authenticateToken` and `requireAdmin`.
- **Email uniqueness:** Enforced at database level to prevent duplicate subscriptions.
- **Validation:** Required fields and max lengths enforced; email format validation.

---

## 🚨 Error Handling

Common responses:

```json
{ "success": false, "message": "Valid email is required" }
```
```json
{ "success": false, "message": "Email is already subscribed" }
```
```json
{ "success": false, "message": "Token or email is required" }
```
```json
{ "success": false, "message": "Subscriber not found" }
```
```json
{ "success": false, "message": "status must be one of: SUBSCRIBED, UNSUBSCRIBED, BOUNCED" }
```
```json
{ "success": false, "message": "Subject and message are required" }
```
```json
{ "success": false, "message": "No subscribers found with the specified status" }
```
```json
{ "success": false, "message": "Admin access required" }
```

---

## 📊 Database Indexes

```typescript
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ subscribedAt: -1 });
newsletterSchema.index({ userId: 1 }, { sparse: true });
newsletterSchema.index({ unsubscribeToken: 1 }, { sparse: true });
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
