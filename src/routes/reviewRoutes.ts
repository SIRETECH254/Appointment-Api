/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: User reviews and ratings management
 */

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

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Create a new review (authenticated users)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentId
 *               - rating
 *             properties:
 *               appointmentId:
 *                 type: string
 *                 description: ID of the appointment being reviewed
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional review comment
 *     responses:
 *       "201":
 *         description: Review created successfully
 *       "400":
 *         description: Invalid input or duplicate review
 *       "401":
 *         description: Unauthorized
 *       "403":
 *         description: Can only review your own appointments
 *       "404":
 *         description: Appointment not found
 *       "500":
 *         description: Server error
 */
router.post("/", authenticateToken, createReview);

/**
 * @swagger
 * /api/reviews:
 *   get:
 *     summary: Get list of reviews (public, shows approved reviews only by default)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID (reviewer)
 *       - in: query
 *         name: appointmentId
 *         schema:
 *           type: string
 *         description: Filter by appointment ID
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *         description: Filter by staff ID (via appointment)
 *       - in: query
 *         name: serviceId
 *         schema:
 *           type: string
 *         description: Filter by service ID (via appointment)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by status (admin only, defaults to APPROVED for public)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       "200":
 *         description: List of reviews with pagination and average rating
 *       "400":
 *         description: Invalid query parameters
 *       "500":
 *         description: Server error
 */
router.get("/", optionalAuth, getReviews);

/**
 * @swagger
 * /api/reviews/{reviewId}:
 *   get:
 *     summary: Get a single review by ID
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       "200":
 *         description: Review details
 *       "400":
 *         description: Invalid reviewId
 *       "404":
 *         description: Review not found
 *       "500":
 *         description: Server error
 */
router.get("/:reviewId", optionalAuth, getReview);

/**
 * @swagger
 * /api/reviews/{reviewId}:
 *   put:
 *     summary: Update a review (owner or admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       "200":
 *         description: Review updated successfully
 *       "400":
 *         description: Invalid input
 *       "401":
 *         description: Unauthorized
 *       "403":
 *         description: Forbidden - can only update your own reviews
 *       "404":
 *         description: Review not found
 *       "500":
 *         description: Server error
 */
router.put("/:reviewId", authenticateToken, updateReview);

/**
 * @swagger
 * /api/reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review (owner or admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       "200":
 *         description: Review deleted successfully
 *       "400":
 *         description: Invalid reviewId
 *       "401":
 *         description: Unauthorized
 *       "403":
 *         description: Forbidden - can only delete your own reviews
 *       "404":
 *         description: Review not found
 *       "500":
 *         description: Server error
 */
router.delete("/:reviewId", authenticateToken, deleteReview);

/**
 * @swagger
 * /api/reviews/{reviewId}/status:
 *   patch:
 *     summary: Update review status (admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *                 description: New status for the review
 *     responses:
 *       "200":
 *         description: Review status updated successfully
 *       "400":
 *         description: Invalid status or reviewId
 *       "401":
 *         description: Unauthorized
 *       "403":
 *         description: Admin access required
 *       "404":
 *         description: Review not found
 *       "500":
 *         description: Server error
 */
router.patch("/:reviewId/status", authenticateToken, requireAdmin, updateReviewStatus);

export default router;
