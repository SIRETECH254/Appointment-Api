import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { errorHandler } from "../middleware/errorHandler";
import Review from "../models/Review";
import Appointment from "../models/Appointment";

const isValidObjectId = (value: string): boolean => mongoose.Types.ObjectId.isValid(value);

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
    let matchStage: any = { $match: query };

    // If filtering by staffId or serviceId, we need to join with appointments
    if (staffId || serviceId) {
      const appointmentMatch: any = {};
      if (staffId) {
        const staffIdStr = String(staffId);
        if (!isValidObjectId(staffIdStr)) {
          return next(errorHandler(400, "Invalid staffId"));
        }
        appointmentMatch.staffId = new mongoose.Types.ObjectId(staffIdStr);
      }
      if (serviceId) {
        const serviceIdStr = String(serviceId);
        if (!isValidObjectId(serviceIdStr)) {
          return next(errorHandler(400, "Invalid serviceId"));
        }
        appointmentMatch.services = new mongoose.Types.ObjectId(serviceIdStr);
      }

      // Use aggregation to filter via appointment
      const reviews = await Review.aggregate([
        { $match: query },
        {
          $lookup: {
            from: "appointments",
            localField: "appointmentId",
            foreignField: "_id",
            as: "appointment"
          }
        },
        { $unwind: "$appointment" },
        { $match: appointmentMatch },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $lookup: {
            from: "users",
            localField: "appointment.staffId",
            foreignField: "_id",
            as: "staff"
          }
        },
        { $unwind: { path: "$staff", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "services",
            localField: "appointment.services",
            foreignField: "_id",
            as: "services"
          }
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            appointmentId: 1,
            rating: 1,
            comment: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            "user.firstName": 1,
            "user.lastName": 1,
            "user.email": 1,
            "user.avatar": 1,
            appointment: 1,
            staff: { firstName: 1, lastName: 1, email: 1, avatar: 1 },
            services: { name: 1 }
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: (options.page - 1) * options.limit },
        { $limit: options.limit }
      ]);

      // Get total count
      const totalResult = await Review.aggregate([
        { $match: query },
        {
          $lookup: {
            from: "appointments",
            localField: "appointmentId",
            foreignField: "_id",
            as: "appointment"
          }
        },
        { $unwind: "$appointment" },
        { $match: appointmentMatch }
      ]);
      const total = totalResult.length;

      // Calculate average rating
      const avgRatingResult = await Review.aggregate([
        { $match: query },
        {
          $lookup: {
            from: "appointments",
            localField: "appointmentId",
            foreignField: "_id",
            as: "appointment"
          }
        },
        { $unwind: "$appointment" },
        { $match: appointmentMatch },
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
      return;
    }

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

export const getReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reviewId } = req.params;
    const reviewIdStr = String(reviewId);

    if (!reviewId || !isValidObjectId(reviewIdStr)) {
      return next(errorHandler(400, "Invalid reviewId"));
    }

    const review = await Review.findById(reviewIdStr)
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

export const updateReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reviewId } = req.params;
    const reviewIdStr = String(reviewId);
    const { rating, comment } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return next(errorHandler(401, "Authentication required"));
    }

    if (!reviewId || !isValidObjectId(reviewIdStr)) {
      return next(errorHandler(400, "Invalid reviewId"));
    }

    const review = await Review.findById(reviewIdStr);
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
      if (trimmedComment.length === 0) {
        review.set("comment", undefined);
      } else {
        review.comment = trimmedComment;
      }
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

export const deleteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reviewId } = req.params;
    const reviewIdStr = String(reviewId);
    const userId = req.user?._id;

    if (!userId) {
      return next(errorHandler(401, "Authentication required"));
    }

    if (!reviewId || !isValidObjectId(reviewIdStr)) {
      return next(errorHandler(400, "Invalid reviewId"));
    }

    const review = await Review.findById(reviewIdStr);
    if (!review) {
      return next(errorHandler(404, "Review not found"));
    }

    // Check ownership or admin
    const userRoleNames = req.user?.roleNames || [];
    const isAdmin = userRoleNames.includes("admin");
    if (!isAdmin && review.userId.toString() !== userId.toString()) {
      return next(errorHandler(403, "You can only delete your own reviews"));
    }

    await Review.findByIdAndDelete(reviewIdStr);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete review error:", error);
    next(errorHandler(500, "Server error while deleting review"));
  }
};

export const updateReviewStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reviewId } = req.params;
    const reviewIdStr = String(reviewId);
    const { status } = req.body;

    if (!reviewId || !isValidObjectId(reviewIdStr)) {
      return next(errorHandler(400, "Invalid reviewId"));
    }

    const allowed: ("PENDING" | "APPROVED" | "REJECTED")[] = ["PENDING", "APPROVED", "REJECTED"];
    if (!status || typeof status !== "string" || !allowed.includes(status as "PENDING" | "APPROVED" | "REJECTED")) {
      return next(errorHandler(400, "status must be one of: PENDING, APPROVED, REJECTED"));
    }

    const review = await Review.findById(reviewIdStr);
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
