import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { errorHandler } from "../middleware/errorHandler";
import BreakModel from "../models/Break";
import User from "../models/User";

const isValidObjectId = (value: string): boolean => mongoose.Types.ObjectId.isValid(value);

// Validation function for HH:MM format
const validateTimeFormat = (time: string): boolean => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

export const createBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, startTime, endTime, reason } = req.body;

    if (!staffId || !startTime || !endTime) {
      return next(errorHandler(400, "staffId, startTime and endTime are required"));
    }

    const staffIdStr = String(staffId);
    if (!isValidObjectId(staffIdStr)) {
      return next(errorHandler(400, "Invalid staffId"));
    }

    const startTimeStr = String(startTime).trim();
    const endTimeStr = String(endTime).trim();

    if (!validateTimeFormat(startTimeStr)) {
      return next(errorHandler(400, "Invalid startTime format. Use HH:MM format (e.g., 13:00)"));
    }

    if (!validateTimeFormat(endTimeStr)) {
      return next(errorHandler(400, "Invalid endTime format. Use HH:MM format (e.g., 14:00)"));
    }

    if (startTimeStr >= endTimeStr) {
      return next(errorHandler(400, "startTime must be earlier than endTime"));
    }

    const staff = await User.findById(staffIdStr).select("_id");
    if (!staff) {
      return next(errorHandler(404, "Staff not found"));
    }

    const newBreak = new BreakModel({
      staffId: staffIdStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      reason: typeof reason === "string" ? reason.trim() : undefined
    });

    await newBreak.save();

    res.status(201).json({
      success: true,
      message: "Break created successfully",
      data: { break: newBreak }
    });
  } catch (error: any) {
    console.error("Create break error:", error);
    if (error.message && error.message.includes("startTime must be earlier")) {
      return next(errorHandler(400, error.message));
    }
    next(errorHandler(500, "Server error while creating break"));
  }
};

export const getBreaks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, page = 1, limit = 10 } = req.query;
    const query: any = {};

    if (staffId) {
      const staffIdStr = String(staffId);
      if (!isValidObjectId(staffIdStr)) {
        return next(errorHandler(400, "Invalid staffId"));
      }
      query.staffId = staffIdStr;
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query breaks with pagination and populate staff
    const breaks = await BreakModel.find(query)
      .populate("staffId", "firstName lastName email phone")
      .sort({ startTime: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await BreakModel.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        breaks,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalBreaks: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get breaks error:", error);
    next(errorHandler(500, "Server error while fetching breaks"));
  }
};

export const getBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const breakIdParam = req.params.breakId;
    if (!breakIdParam) {
      return next(errorHandler(400, "breakId is required"));
    }
    const breakId = String(breakIdParam);
    if (!isValidObjectId(breakId)) {
      return next(errorHandler(400, "Invalid breakId"));
    }

    const existing = await BreakModel.findById(breakId);
    if (!existing) {
      return next(errorHandler(404, "Break not found"));
    }

    res.status(200).json({
      success: true,
      data: { break: existing }
    });
  } catch (error: any) {
    console.error("Get break error:", error);
    next(errorHandler(500, "Server error while fetching break"));
  }
};

export const updateBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const breakIdParam = req.params.breakId;
    const { staffId, startTime, endTime, reason } = req.body;

    if (!breakIdParam) {
      return next(errorHandler(400, "breakId is required"));
    }
    const breakId = String(breakIdParam);
    if (!isValidObjectId(breakId)) {
      return next(errorHandler(400, "Invalid breakId"));
    }

    const existing = await BreakModel.findById(breakId);
    if (!existing) {
      return next(errorHandler(404, "Break not found"));
    }

    if (staffId !== undefined) {
      const staffIdStr = String(staffId);
      if (!isValidObjectId(staffIdStr)) {
        return next(errorHandler(400, "Invalid staffId"));
      }
      const staff = await User.findById(staffIdStr).select("_id");
      if (!staff) {
        return next(errorHandler(404, "Staff not found"));
      }
      existing.staffId = staff._id;
    }

    if (startTime !== undefined) {
      const startTimeStr = String(startTime).trim();
      if (!validateTimeFormat(startTimeStr)) {
        return next(errorHandler(400, "Invalid startTime format. Use HH:MM format (e.g., 13:00)"));
      }
      existing.startTime = startTimeStr;
    }

    if (endTime !== undefined) {
      const endTimeStr = String(endTime).trim();
      if (!validateTimeFormat(endTimeStr)) {
        return next(errorHandler(400, "Invalid endTime format. Use HH:MM format (e.g., 14:00)"));
      }
      existing.endTime = endTimeStr;
    }

    // Validate startTime < endTime (using string comparison)
    if (existing.startTime >= existing.endTime) {
      return next(errorHandler(400, "startTime must be earlier than endTime"));
    }

    if (reason !== undefined) {
      if (reason === null || (typeof reason === "string" && reason.trim().length === 0)) {
        existing.set("reason", undefined);
      } else if (typeof reason === "string") {
        existing.reason = reason.trim();
      }
    }

    await existing.save();

    res.status(200).json({
      success: true,
      message: "Break updated successfully",
      data: { break: existing }
    });
  } catch (error: any) {
    console.error("Update break error:", error);
    if (error.message && error.message.includes("startTime must be earlier")) {
      return next(errorHandler(400, error.message));
    }
    next(errorHandler(500, "Server error while updating break"));
  }
};

export const deleteBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const breakIdParam = req.params.breakId;
    if (!breakIdParam) {
      return next(errorHandler(400, "breakId is required"));
    }
    const breakId = String(breakIdParam);
    if (!isValidObjectId(breakId)) {
      return next(errorHandler(400, "Invalid breakId"));
    }

    const existing = await BreakModel.findById(breakId);
    if (!existing) {
      return next(errorHandler(404, "Break not found"));
    }

    await BreakModel.findByIdAndDelete(breakId);

    res.status(200).json({
      success: true,
      message: "Break deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete break error:", error);
    next(errorHandler(500, "Server error while deleting break"));
  }
};
