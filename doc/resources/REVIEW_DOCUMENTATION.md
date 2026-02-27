# ⭐ Appointment API - Review Management Documentation

## 📋 Table of Contents
- [Review Overview](#review-overview)
- [Review Model](#-review-model)
- [Review Controller](#-review-controller)
- [Review Routes](#-review-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Review Overview

Reviews allow customers to rate (1-5) and comment on their appointments. Reviews are linked to appointments, which already contain staff and service information, so reviews only need to reference the `appointmentId`.

Key features:
- Customers can review their own appointments
- Only completed appointments can be reviewed
- One review per appointment per user
- Rating scale: 1-5 (required)
- Optional comment (max 1000 characters)
- Status management: PENDING, APPROVED, REJECTED (default: APPROVED)
- Filtering by appointment, user, staff, or service
- Average rating calculation
- Public viewing of approved reviews
- Admin moderation capabilities

Integration with Appointments:
- Reviews link to appointments via `appointmentId`
- When populated, appointments include `staffId` and `services` array
- Staff and service information is accessible through the appointment relationship

---

## 🧩 Review Model

### Schema Definition
```typescript
interface IReview {
  _id: ObjectId;
  userId: ObjectId;
  appointmentId: ObjectId;
  rating: number; // 1-5
  comment?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File:** `src/models/Review.ts`

```typescript
import mongoose, { Schema } from "mongoose";
import type { IReview } from "../types/index";

const reviewSchema = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"]
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: [true, "Appointment is required"]
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating must be at most 5"]
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"]
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "APPROVED"
    }
  },
  { timestamps: true }
);

reviewSchema.index({ userId: 1 });
reviewSchema.index({ appointmentId: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ createdAt: -1 });

const Review = mongoose.model<IReview>("Review", reviewSchema);

export default Review;
```

### Validation Rules
```typescript
userId:        { required: true, ref: User }
appointmentId: { required: true, ref: Appointment }
rating:        { required: true, min: 1, max: 5 }
comment:       { optional, maxlength: 1000 }
status:        { default: "APPROVED", enum: PENDING | APPROVED | REJECTED }
```

**Note:** Users can only create one review per appointment. The system validates that:
- The appointment belongs to the user
- The appointment status is "COMPLETED"
- The user hasn't already reviewed this appointment

---

## 🎮 Review Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { errorHandler } from "../middleware/errorHandler";
import Review from "../models/Review";
import Appointment from "../models/Appointment";
```

### Functions Overview

#### `createReview()`
**Purpose:** Create a review for an appointment  
**Access:** Authenticated users  
**Validation:** `appointmentId`, `rating` (1-5) required. `comment` optional (max 1000 chars). Appointment must belong to user and have status "COMPLETED". One review per appointment.  
**Response:** Created review with populated user and appointment (including staff and services)

**Controller Implementation:**
```typescript
export const createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId, rating, comment } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(errorHandler(401, "Authentication required"));
    }

    if (!appointmentId) {
      return next(errorHandler(400, "appointmentId is required"));
    }

    const appointmentIdStr = String(appointmentId);
    if (!isValidObjectId(appointmentIdStr)) {
      return next(errorHandler(400, "Invalid appointmentId"));
    }

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return next(errorHandler(400, "Rating must be a number between 1 and 5"));
    }

    const trimmedComment = typeof comment === "string" ? comment.trim() : "";
    if (trimmedComment && trimmedComment.length > 1000) {
      return next(errorHandler(400, "Comment cannot exceed 1000 characters"));
    }

    // Verify appointment exists and belongs to the user
    const appointment = await Appointment.findById(appointmentIdStr);
    if (!appointment) {
      return next(errorHandler(404, "Appointment not found"));
    }

    if (appointment.customerId.toString() !== userId.toString()) {
      return next(errorHandler(403, "You can only review your own appointments"));
    }

    // Check if appointment is completed
    if (appointment.status !== "COMPLETED") {
      return next(errorHandler(400, "You can only review completed appointments"));
    }

    // Check if user already reviewed this appointment
    const existingReview = await Review.findOne({ userId, appointmentId: appointmentIdStr });
    if (existingReview) {
      return next(errorHandler(400, "You have already reviewed this appointment"));
    }

    const review = new Review({
      userId,
      appointmentId: appointmentIdStr,
      rating,
      comment: trimmedComment || undefined,
      status: "APPROVED"
    });

    await review.save();
    await review.populate("userId", "firstName lastName email avatar");
    await review.populate({
      path: "appointmentId",
      populate: [
        { path: "staffId", select: "firstName lastName email avatar" },
        { path: "services", select: "name" }
      ]
    });

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: { review }
    });
  } catch (error: any) {
    console.error("Create review error:", error);
    next(errorHandler(500, "Server error while creating review"));
  }
};
```

#### `getReviews()`
**Purpose:** List reviews with filtering and pagination  
**Access:** Public (shows approved only by default, admin can filter by status)  
**Query:** `userId`, `appointmentId`, `staffId`, `serviceId`, `status`, `page`, `limit`  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Response:** Review list with populated user and appointment data, pagination info, and average rating

**Note:** When filtering by `staffId` or `serviceId`, the system uses MongoDB aggregation to join with appointments since these fields are not directly on the review model.

**Controller Implementation:**
```typescript
export const getReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, appointmentId, staffId, serviceId, status, page = 1, limit = 10 } = req.query;
    const query: any = {};

    // Check if user is admin for status filtering
    const userRoleNames = req.user?.roleNames || [];
    const isAdmin = userRoleNames.includes("admin");

    if (userId) {
      const userIdStr = String(userId);
      if (!isValidObjectId(userIdStr)) {
        return next(errorHandler(400, "Invalid userId"));
      }
      query.userId = userIdStr;
    }

    if (appointmentId) {
      const appointmentIdStr = String(appointmentId);
      if (!isValidObjectId(appointmentIdStr)) {
        return next(errorHandler(400, "Invalid appointmentId"));
      }
      query.appointmentId = appointmentIdStr;
    }

    // Filter by status - default to APPROVED for non-admins
    if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") {
      query.status = status;
    } else if (!isAdmin) {
      // Non-admins only see approved reviews
      query.status = "APPROVED";
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Build aggregation pipeline for filtering by staffId or serviceId via appointment
    // ... (uses MongoDB aggregation when staffId or serviceId filters are present)
    
    // Standard query without staffId/serviceId filtering
    const reviews = await Review.find(query)
      .populate("userId", "firstName lastName email avatar")
      .populate({
        path: "appointmentId",
        populate: [
          { path: "staffId", select: "firstName lastName email avatar" },
          { path: "services", select: "name" }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Review.countDocuments(query);

    // Calculate average rating
    const avgRatingResult = await Review.aggregate([
      { $match: query },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } }
    ]);
    const avgRating = avgRatingResult.length > 0 ? avgRatingResult[0].avgRating : 0;

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalReviews: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        },
        averageRating: avgRating ? parseFloat(avgRating.toFixed(2)) : 0
      }
    });
  } catch (error: any) {
    console.error("Get reviews error:", error);
    next(errorHandler(500, "Server error while fetching reviews"));
  }
};
```

#### `getReview()`
**Purpose:** Get a review by id  
**Access:** Public  
**Response:** Review record with populated user and appointment information

**Controller Implementation:**
```typescript
export const getReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reviewId } = req.params;

    if (!reviewId || !isValidObjectId(reviewId)) {
      return next(errorHandler(400, "Invalid reviewId"));
    }

    const review = await Review.findById(reviewId)
      .populate("userId", "firstName lastName email avatar")
      .populate({
        path: "appointmentId",
        populate: [
          { path: "staffId", select: "firstName lastName email avatar" },
          { path: "services", select: "name" }
        ]
      });

    if (!review) {
      return next(errorHandler(404, "Review not found"));
    }

    res.status(200).json({
      success: true,
      data: { review }
    });
  } catch (error: any) {
    console.error("Get review error:", error);
    next(errorHandler(500, "Server error while fetching review"));
  }
};
```

#### `updateReview()`
**Purpose:** Update review rating or comment  
**Access:** Owner or admin  
**Validation:** `reviewId` required. `rating` (1-5) and `comment` (max 1000 chars) are optional update fields.  
**Response:** Updated review

**Controller Implementation:**
```typescript
export const updateReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(errorHandler(401, "Authentication required"));
    }

    if (!reviewId || !isValidObjectId(reviewId)) {
      return next(errorHandler(400, "Invalid reviewId"));
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, "Review not found"));
    }

    // Check ownership or admin
    const userRoleNames = req.user?.roleNames || [];
    const isAdmin = userRoleNames.includes("admin");
    if (!isAdmin && review.userId.toString() !== userId.toString()) {
      return next(errorHandler(403, "You can only update your own reviews"));
    }

    if (rating !== undefined) {
      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        return next(errorHandler(400, "Rating must be a number between 1 and 5"));
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      const trimmedComment = typeof comment === "string" ? comment.trim() : "";
      if (trimmedComment.length > 1000) {
        return next(errorHandler(400, "Comment cannot exceed 1000 characters"));
      }
      review.comment = trimmedComment || undefined;
    }

    await review.save();
    await review.populate("userId", "firstName lastName email avatar");
    await review.populate({
      path: "appointmentId",
      populate: [
        { path: "staffId", select: "firstName lastName email avatar" },
        { path: "services", select: "name" }
      ]
    });

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: { review }
    });
  } catch (error: any) {
    console.error("Update review error:", error);
    next(errorHandler(500, "Server error while updating review"));
  }
};
```

#### `deleteReview()`
**Purpose:** Delete a review  
**Access:** Owner or admin  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return next(errorHandler(401, "Authentication required"));
    }

    if (!reviewId || !isValidObjectId(reviewId)) {
      return next(errorHandler(400, "Invalid reviewId"));
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, "Review not found"));
    }

    // Check ownership or admin
    const userRoleNames = req.user?.roleNames || [];
    const isAdmin = userRoleNames.includes("admin");
    if (!isAdmin && review.userId.toString() !== userId.toString()) {
      return next(errorHandler(403, "You can only delete your own reviews"));
    }

    await Review.findByIdAndDelete(reviewId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete review error:", error);
    next(errorHandler(500, "Server error while deleting review"));
  }
};
```

#### `updateReviewStatus()`
**Purpose:** Update review status (PENDING/APPROVED/REJECTED)  
**Access:** Admin only  
**Validation:** `reviewId` required. `status` must be one of: PENDING, APPROVED, REJECTED  
**Response:** Updated review with new status

**Controller Implementation:**
```typescript
export const updateReviewStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;

    if (!reviewId || !isValidObjectId(reviewId)) {
      return next(errorHandler(400, "Invalid reviewId"));
    }

    const allowed: ("PENDING" | "APPROVED" | "REJECTED")[] = ["PENDING", "APPROVED", "REJECTED"];
    if (!status || typeof status !== "string" || !allowed.includes(status as "PENDING" | "APPROVED" | "REJECTED")) {
      return next(errorHandler(400, "status must be one of: PENDING, APPROVED, REJECTED"));
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return next(errorHandler(404, "Review not found"));
    }

    review.status = status as "PENDING" | "APPROVED" | "REJECTED";
    await review.save();
    await review.populate("userId", "firstName lastName email avatar");
    await review.populate({
      path: "appointmentId",
      populate: [
        { path: "staffId", select: "firstName lastName email avatar" },
        { path: "services", select: "name" }
      ]
    });

    res.status(200).json({
      success: true,
      message: "Review status updated successfully",
      data: { review }
    });
  } catch (error: any) {
    console.error("Update review status error:", error);
    next(errorHandler(500, "Server error while updating review status"));
  }
};
```

---

## 🛣️ Review Routes

### Base Path: `/api/reviews`

```typescript
POST   /                          // Create review (authenticated)
GET    /                          // List reviews (public, optional auth)
GET    /:reviewId                 // Get review (public)
PUT    /:reviewId                 // Update review (owner/admin)
DELETE /:reviewId                 // Delete review (owner/admin)
PATCH  /:reviewId/status          // Update status (admin only)
```

### Router Implementation

**File:** `src/routes/reviewRoutes.ts`

```typescript
import express from "express";
import {
  createReview,
  getReviews,
  getReview,
  updateReview,
  deleteReview,
  updateReviewStatus
} from "../controllers/reviewController";
import { authenticateToken, requireAdmin, optionalAuth } from "../middleware/auth";

const router = express.Router();

router.post("/", authenticateToken, createReview);
router.get("/", optionalAuth, getReviews);
router.get("/:reviewId", optionalAuth, getReview);
router.put("/:reviewId", authenticateToken, updateReview);
router.delete("/:reviewId", authenticateToken, deleteReview);
router.patch("/:reviewId/status", authenticateToken, requireAdmin, updateReviewStatus);

export default router;
```

### Route Details

#### `POST /api/reviews`
**Headers:** `Authorization: Bearer <token>`  
**Body:**
```json
{
  "appointmentId": "<appointmentId>",
  "rating": 5,
  "comment": "Great service!"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Review created successfully",
  "data": {
    "review": {
      "_id": "...",
      "userId": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "avatar": "..."
      },
      "appointmentId": {
        "_id": "...",
        "staffId": {
          "_id": "...",
          "firstName": "Jane",
          "lastName": "Staff",
          "email": "jane@example.com"
        },
        "services": [
          {
            "_id": "...",
            "name": "Haircut"
          }
        ]
      },
      "rating": 5,
      "comment": "Great service!",
      "status": "APPROVED",
      "createdAt": "2026-01-23T10:00:00.000Z",
      "updatedAt": "2026-01-23T10:00:00.000Z"
    }
  }
}
```
**Note:** The review includes populated user and appointment data. The appointment includes staff and services information.

#### `GET /api/reviews`
**Headers:** `Authorization: Bearer <token>` (optional, required for admin status filtering)  
**Query (optional):** `userId`, `appointmentId`, `staffId`, `serviceId`, `status`, `page`, `limit`  
**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "_id": "...",
        "userId": {
          "_id": "...",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com",
          "avatar": "..."
        },
        "appointmentId": {
          "_id": "...",
          "staffId": {
            "_id": "...",
            "firstName": "Jane",
            "lastName": "Staff"
          },
          "services": [
            {
              "_id": "...",
              "name": "Haircut"
            }
          ]
        },
        "rating": 5,
        "comment": "Great service!",
        "status": "APPROVED",
        "createdAt": "2026-01-23T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalReviews": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    },
    "averageRating": 5.0
  }
}
```
**Note:** By default, only approved reviews are shown. Admins can filter by status. When filtering by `staffId` or `serviceId`, the system uses aggregation to join with appointments.

#### `GET /api/reviews/:reviewId`
**Response:**
```json
{
  "success": true,
  "data": {
    "review": {
      "_id": "...",
      "userId": {...},
      "appointmentId": {...},
      "rating": 5,
      "comment": "Great service!",
      "status": "APPROVED"
    }
  }
}
```

#### `PUT /api/reviews/:reviewId`
**Headers:** `Authorization: Bearer <token>`  
**Body:**
```json
{
  "rating": 4,
  "comment": "Updated comment"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Review updated successfully",
  "data": {
    "review": {...}
  }
}
```

#### `DELETE /api/reviews/:reviewId`
**Headers:** `Authorization: Bearer <token>`  
**Response:**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

#### `PATCH /api/reviews/:reviewId/status`
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:**
```json
{
  "status": "REJECTED"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Review status updated successfully",
  "data": {
    "review": {...}
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
router.post("/", authenticateToken, createReview);
```

#### `optionalAuth`
**Purpose:** Attach user if token exists, otherwise continue  
**Usage:**
```typescript
router.get("/", optionalAuth, getReviews);
```
**Note:** Allows public access but enables admin features (like status filtering) if authenticated.

#### `requireAdmin`
**Purpose:** Admin-only operations  
**Usage:**
```typescript
router.patch("/:reviewId/status", authenticateToken, requireAdmin, updateReviewStatus);
```

---

## 📝 API Examples

### Create Review
```bash
curl -X POST http://localhost:4500/api/reviews \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "appointmentId": "<appointmentId>",
    "rating": 5,
    "comment": "Excellent service!"
  }'
```

### List Reviews
```bash
curl -X GET "http://localhost:4500/api/reviews?staffId=<staffId>&page=1&limit=10"
```

### Get Single Review
```bash
curl -X GET "http://localhost:4500/api/reviews/<reviewId>"
```

### Update Review
```bash
curl -X PUT http://localhost:4500/api/reviews/<reviewId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "rating": 4,
    "comment": "Updated review"
  }'
```

### Delete Review
```bash
curl -X DELETE http://localhost:4500/api/reviews/<reviewId> \
  -H "Authorization: Bearer <token>"
```

### Update Review Status (Admin)
```bash
curl -X PATCH http://localhost:4500/api/reviews/<reviewId>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "status": "REJECTED"
  }'
```

---

## 🛡️ Security Features

- **Authentication Required:** Create, update, and delete operations require authentication
- **Ownership Validation:** Users can only review their own appointments
- **Appointment Status Validation:** Only completed appointments can be reviewed
- **Duplicate Prevention:** One review per appointment per user
- **Admin Moderation:** Admins can update review status and view all reviews regardless of status
- **Public Viewing:** Approved reviews are publicly viewable
- **Status Filtering:** Non-admins only see approved reviews by default

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "appointmentId is required" }
```

```json
{ "success": false, "message": "Rating must be a number between 1 and 5" }
```

```json
{ "success": false, "message": "You can only review your own appointments" }
```

```json
{ "success": false, "message": "You can only review completed appointments" }
```

```json
{ "success": false, "message": "You have already reviewed this appointment" }
```

```json
{ "success": false, "message": "You can only update your own reviews" }
```

---

## 📊 Database Indexes

```typescript
reviewSchema.index({ userId: 1 });
reviewSchema.index({ appointmentId: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ createdAt: -1 });
```

**Indexes:**
- `userId`: Fast lookup of reviews by user
- `appointmentId`: Fast lookup of reviews for a specific appointment
- `status`: Efficient filtering by approval status
- `createdAt`: Sorting reviews by creation date (descending)

---

**Last Updated:** January 2026  
**Version:** 1.0.0
