import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { errorHandler } from "../middleware/errorHandler";
import BreakModel from "../models/Break";
import User from "../models/User";

const isValidObjectId = (value: string): boolean => mongoose.Types.ObjectId.isValid(value);

const parseDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseDateOnly = (date: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildDayRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
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

    const start = parseDate(String(startTime));
    const end = parseDate(String(endTime));
    if (!start || !end) {
      return next(errorHandler(400, "Invalid startTime or endTime"));
    }

    if (start >= end) {
      return next(errorHandler(400, "startTime must be earlier than endTime"));
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
    const { staffId, date, from, to } = req.query;
    const query: any = {};

    if (staffId) {
      const staffIdStr = String(staffId);
      if (!isValidObjectId(staffIdStr)) {
        return next(errorHandler(400, "Invalid staffId"));
      }
      query.staffId = staffIdStr;
    }

    if (date) {
      const dateOnly = parseDateOnly(String(date));
      if (!dateOnly) {
        return next(errorHandler(400, "Invalid date format. Use YYYY-MM-DD"));
      }
      const { start, end } = buildDayRange(dateOnly);
      query.startTime = { $lt: end };
      query.endTime = { $gt: start };
    } else if (from || to) {
      const fromDate = from ? parseDate(String(from)) : null;
      const toDate = to ? parseDate(String(to)) : null;
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

    const breaks = await BreakModel.find(query).sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      data: { breaks }
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
      const start = parseDate(String(startTime));
      if (!start) {
        return next(errorHandler(400, "Invalid startTime"));
      }
      existing.startTime = start;
    }

    if (endTime !== undefined) {
      const end = parseDate(String(endTime));
      if (!end) {
        return next(errorHandler(400, "Invalid endTime"));
      }
      existing.endTime = end;
    }

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
