import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { errorHandler } from "../middleware/errorHandler";
import BreakModel from "../models/Break";
import User from "../models/User";
import { parseNairobiDateToUTC, combineNairobiDateAndTimeToUTC, buildNairobiDayRangeUTC } from '../utils/availability'; // Import utility functions

const isValidObjectId = (value: string): boolean => mongoose.Types.ObjectId.isValid(value);


export const createBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, date, startTime: timeStart, endTime: timeEnd, reason } = req.body;

    if (!staffId || !date || !timeStart || !timeEnd) {
      return next(errorHandler(400, "staffId, date, startTime and endTime are required"));
    }

    const staffIdStr = String(staffId);
    if (!isValidObjectId(staffIdStr)) {
      return next(errorHandler(400, "Invalid staffId"));
    }

    const dateOnlyUTC = parseNairobiDateToUTC(date);
    if (!dateOnlyUTC) {
      return next(errorHandler(400, "Invalid date format. Use YYYY-MM-DD"));
    }

    const start = combineNairobiDateAndTimeToUTC(dateOnlyUTC, timeStart);
    const end = combineNairobiDateAndTimeToUTC(dateOnlyUTC, timeEnd);

    if (!start || !end) {
      return next(errorHandler(400, "Invalid startTime or endTime format. Use HH:MM"));
    }

    if (start >= end) {
      return next(errorHandler(400, "startTime must be earlier than endTime"));
    }

    const nowUTC = new Date();
    if (end.getTime() <= nowUTC.getTime()) {
        return next(errorHandler(400, "Cannot create a break in the past"));
    }

    const staff = await User.findById(staffIdStr).select("_id");
    if (!staff) {
      return next(errorHandler(404, "Staff not found"));
    }

    const newBreak = new BreakModel({
      staffId: staffIdStr,
      startTime: start,
      endTime: end,
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
    next(errorHandler(500, "Server error while creating break"));
  }
};

export const getBreaks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, date, from, to, page = 1, limit = 10 } = req.query;
    const query: any = {};

    if (staffId) {
      const staffIdStr = String(staffId);
      if (!isValidObjectId(staffIdStr)) {
        return next(errorHandler(400, "Invalid staffId"));
      }
      query.staffId = staffIdStr;
    }

    if (date) {
      const dateOnlyUTC = parseNairobiDateToUTC(String(date));
      if (!dateOnlyUTC) {
        return next(errorHandler(400, "Invalid date format. Use YYYY-MM-DD"));
      }
      const { start, end } = buildNairobiDayRangeUTC(dateOnlyUTC);
      query.startTime = { $lt: end };
      query.endTime = { $gt: start };
    } else if (from || to) {
      const fromDate = from ? new Date(String(from)) : null;
      const toDate = to ? new Date(String(to)) : null;
      if ((from && !fromDate) || (to && !toDate)) {
        return next(errorHandler(400, "Invalid from or to date"));
      }
      if (fromDate && toDate) {
        query.startTime = { $lt: toDate };
        query.endTime = { $gt: fromDate };
      } else if (fromDate) {
        query.endTime = { $gt: fromDate };
      } else if (toDate) {
        query.startTime = { $lt: toDate };
      }
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
    const { staffId, date, startTime: timeStart, endTime: timeEnd, reason } = req.body;

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

    let updatedStartTime: Date | null = existing.startTime;
    let updatedEndTime: Date | null = existing.endTime;
    let baseDateForTimes = existing.startTime; // Start with existing break's date part (which is UTC)

    // If a new date is provided, update the base date for time calculations
    if (date !== undefined) {
        const newDateUTC = parseNairobiDateToUTC(date);
        if (!newDateUTC) {
            return next(errorHandler(400, "Invalid date format. Use YYYY-MM-DD"));
        }
        // When changing date, time parts should remain the same as existing, but applied to new date
        baseDateForTimes = newDateUTC;
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

    // Update startTime if timeStart (HH:MM) is provided or if date was changed
    if (timeStart !== undefined) {
        const newStart = combineNairobiDateAndTimeToUTC(baseDateForTimes, timeStart);
        if (!newStart) {
            return next(errorHandler(400, "Invalid startTime format. Use HH:MM"));
        }
        updatedStartTime = newStart;
    } else if (date !== undefined) { // If only date changed, reconstruct startTime with old time
        // existing.startTime is UTC, so get its HH:MM based on Nairobi offset
        const existingStartHour = existing.startTime.getUTCHours() + 3; // EAT offset
        const existingStartMinute = existing.startTime.getUTCMinutes();
        const existingTimeStr = `${String(existingStartHour % 24).padStart(2, '0')}:${String(existingStartMinute).padStart(2, '0')}`;
        
        updatedStartTime = combineNairobiDateAndTimeToUTC(baseDateForTimes, existingTimeStr);
        if (!updatedStartTime) {
            return next(errorHandler(500, "Failed to reconstruct startTime with new date"));
        }
    }

    // Update endTime if timeEnd (HH:MM) is provided or if date was changed
    if (timeEnd !== undefined) {
        const newEnd = combineNairobiDateAndTimeToUTC(baseDateForTimes, timeEnd);
        if (!newEnd) {
            return next(errorHandler(400, "Invalid endTime format. Use HH:MM"));
        }
        updatedEndTime = newEnd;
    } else if (date !== undefined) { // If only date changed, reconstruct endTime with old time
        const existingEndHour = existing.endTime.getUTCHours() + 3; // EAT offset
        const existingEndMinute = existing.endTime.getUTCMinutes();
        const existingTimeStr = `${String(existingEndHour % 24).padStart(2, '0')}:${String(existingEndMinute).padStart(2, '0')}`;

        updatedEndTime = combineNairobiDateAndTimeToUTC(baseDateForTimes, existingTimeStr);
        if (!updatedEndTime) {
            return next(errorHandler(500, "Failed to reconstruct endTime with new date"));
        }
    }
    
    // Apply updated times to the existing document
    existing.startTime = updatedStartTime!;
    existing.endTime = updatedEndTime!;

    if (existing.startTime.getTime() >= existing.endTime.getTime()) {
      return next(errorHandler(400, "startTime must be earlier than endTime"));
    }

    const nowUTC = new Date();
    if (existing.endTime.getTime() <= nowUTC.getTime()) {
        return next(errorHandler(400, "Cannot update a break to be in the past"));
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
