import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Service from "../models/Service";
import Appointment from "../models/Appointment";
import BreakModel from "../models/Break";
import {
  checkSlotAvailability,
  parseNairobiDateToUTC,
  combineNairobiDateAndTimeToUTC,
  buildNairobiDayRangeUTC,
  startOfTodayNairobiUTC,
  getDayKey // Also import getDayKey from utils now
} from "../utils/availability"; // Import utility functions

type TimeRange = { start: Date; end: Date };

const isValidObjectId = (value: string): boolean => mongoose.Types.ObjectId.isValid(value);

const overlaps = (slot: TimeRange, event: TimeRange): boolean =>
  slot.start < event.end && slot.end > event.start;

// This computeSlots needs to use the new combineNairobiDateAndTimeToUTC and buildNairobiDayRangeUTC
// This function needs to be updated. It still uses combineDateAndTime and buildDayRange.
const computeSlots = (
  workingRanges: Array<{ start: string; end: string }>,
  date: Date, // This 'date' is expected to be a UTC date, corresponding to Nairobi local midnight
  durationMinutes: number,
  events: TimeRange[]
): { totalSlots: number; availableSlots: TimeRange[] } => {
  let totalSlots = 0;
  const availableSlots: TimeRange[] = [];

  for (const range of workingRanges) {
    // Use the new Nairobi-aware combine function
    const rangeStart = combineNairobiDateAndTimeToUTC(date, range.start);
    const rangeEnd = combineNairobiDateAndTimeToUTC(date, range.end);
    if (!rangeStart || !rangeEnd || rangeStart >= rangeEnd) {
      continue;
    }

    let slotStart = new Date(rangeStart);
    while (true) {
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000); // addMinutes equivalent
      if (slotEnd > rangeEnd) break;

      const slot = { start: new Date(slotStart), end: slotEnd };
      totalSlots += 1;

      const hasOverlap = events.some((event) => overlaps(slot, event));
      if (!hasOverlap) {
        availableSlots.push(slot);
      }

      slotStart = slotEnd;
    }
  }

  return { totalSlots, availableSlots };
};

const toServiceIdList = (serviceId: string | string[]): string[] => {
  if (Array.isArray(serviceId)) {
    return serviceId.map((value) => String(value));
  }
  return [String(serviceId)];
};

const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const getAvailableSlots = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staffId, serviceId, date } = req.query;

    if (!staffId || !serviceId || !date) {
      return next(errorHandler(400, "staffId, serviceId and date are required"));
    }

    const staffIdStr = String(staffId);
    const serviceIds = toServiceIdList(serviceId as string | string[]);
    const dateStr = String(date);

    if (!isValidObjectId(staffIdStr) || serviceIds.some((id) => !isValidObjectId(id))) {
      return next(errorHandler(400, "Invalid staffId or serviceId"));
    }

    const dateOnlyUTC = parseNairobiDateToUTC(dateStr);
    if (!dateOnlyUTC) {
      return next(errorHandler(400, "Invalid date format. Use YYYY-MM-DD"));
    }

    const todayStartNairobiUTC = startOfTodayNairobiUTC();
    if (dateOnlyUTC.getTime() < todayStartNairobiUTC.getTime()) {
      res.status(200).json({
        success: true,
        message: "date has passed",
        data: { slots: [] }
      });
      return;
    }

    const staff = await User.findById(staffIdStr).select("workingHours services");
    if (!staff) {
      return next(errorHandler(404, "Staff not found"));
    }

    if (!staff.services || staff.services.length === 0) {
      res.status(200).json({
        success: true,
        message: "No services assigned to staff",
        data: { slots: [] }
      });
      return;
    }

    const staffServiceIds = staff.services.map((id) => id.toString());
    const hasAllServices = serviceIds.every((id) => staffServiceIds.includes(id));
    if (!hasAllServices) {
      return next(errorHandler(400, "Staff does not provide requested services"));
    }

    const services = await Service.find({ _id: { $in: serviceIds } }).select("duration");
    if (services.length !== serviceIds.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    const totalDuration = services.reduce((sum, item) => sum + (item.duration || 0), 0);

    const dayKey = getDayKey(dateOnlyUTC);
    const workingRanges = staff.workingHours?.[dayKey as keyof typeof staff.workingHours] || [];

    if (!workingRanges || workingRanges.length === 0) {
      res.status(200).json({
        success: true,
        message: "No working hours for this day",
        data: { slots: [] }
      });
      return;
    }

    const { start, end } = buildNairobiDayRangeUTC(dateOnlyUTC);

    const appointments = await Appointment.find({
      staffId: staffIdStr,
      startTime: { $lt: end },
      endTime: { $gt: start }
    }).select("startTime endTime");

    const breaks = await BreakModel.find({
      staffId: staffIdStr,
      startTime: { $lt: end },
      endTime: { $gt: start }
    }).select("startTime endTime");

    const events: TimeRange[] = [
      ...appointments.map((item) => ({ start: item.startTime, end: item.endTime })),
      ...breaks.map((item) => ({ start: item.startTime, end: item.endTime }))
    ];

    const { availableSlots } = computeSlots(workingRanges, dateOnlyUTC, totalDuration, events);
    const nowUTC = new Date();
    const filteredSlots =
      dateOnlyUTC.getTime() === todayStartNairobiUTC.getTime()
        ? availableSlots.filter((slot) => slot.end.getTime() > nowUTC.getTime())
        : availableSlots;

    if (filteredSlots.length === 0 && dateOnlyUTC.getTime() === todayStartNairobiUTC.getTime()) {
      res.status(200).json({
        success: true,
        message: "time has passed",
        data: { slots: [] }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        slots: filteredSlots.map((slot) => ({
          startTime: slot.start,
          endTime: slot.end
        }))
      }
    });
  } catch (error: any) {
    console.error("Get available slots error:", error);
    next(errorHandler(500, "Server error while calculating availability"));
  }
};

export const getDayAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { staffId, serviceId, date } = req.query;

    if (!staffId || !serviceId || !date) {
      return next(errorHandler(400, "staffId, serviceId and date are required"));
    }

    const staffIdStr = String(staffId);
    const serviceIds = toServiceIdList(serviceId as string | string[]);
    const dateStr = String(date);

    if (!isValidObjectId(staffIdStr) || serviceIds.some((id) => !isValidObjectId(id))) {
      return next(errorHandler(400, "Invalid staffId or serviceId"));
    }

    const dateOnlyUTC = parseNairobiDateToUTC(dateStr);
    if (!dateOnlyUTC) {
      return next(errorHandler(400, "Invalid date format. Use YYYY-MM-DD"));
    }

    const todayStartNairobiUTC = startOfTodayNairobiUTC();
    if (dateOnlyUTC.getTime() < todayStartNairobiUTC.getTime()) {
      res.status(200).json({
        success: true,
        message: "date has passed",
        data: {
          date: dateStr,
          totalSlots: 0,
          availableSlots: 0
        }
      });
      return;
    }

    const staff = await User.findById(staffIdStr).select("workingHours services");
    if (!staff) {
      return next(errorHandler(404, "Staff not found"));
    }

    if (!staff.services || staff.services.length === 0) {
      res.status(200).json({
        success: true,
        message: "No services assigned to staff",
        data: {
          date: dateStr,
          totalSlots: 0,
          availableSlots: 0
        }
      });
      return;
    }

    const staffServiceIds = staff.services.map((id) => id.toString());
    const hasAllServices = serviceIds.every((id) => staffServiceIds.includes(id));
    if (!hasAllServices) {
      return next(errorHandler(400, "Staff does not provide requested services"));
    }

    const services = await Service.find({ _id: { $in: serviceIds } }).select("duration");
    if (services.length !== serviceIds.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    const totalDuration = services.reduce((sum, item) => sum + (item.duration || 0), 0);

    const dayKey = getDayKey(dateOnlyUTC);
    const workingRanges = staff.workingHours?.[dayKey as keyof typeof staff.workingHours] || [];

    if (!workingRanges || workingRanges.length === 0) {
      res.status(200).json({
        success: true,
        message: "No working hours for this day",
        data: {
          date: dateStr,
          totalSlots: 0,
          availableSlots: 0
        }
      });
      return;
    }

    const { start, end } = buildNairobiDayRangeUTC(dateOnlyUTC);

    const appointments = await Appointment.find({
      staffId: staffIdStr,
      startTime: { $lt: end },
      endTime: { $gt: start }
    }).select("startTime endTime");

    const breaks = await BreakModel.find({
      staffId: staffIdStr,
      startTime: { $lt: end },
      endTime: { $gt: start }
    }).select("startTime endTime");

    const events: TimeRange[] = [
      ...appointments.map((item) => ({ start: item.startTime, end: item.endTime })),
      ...breaks.map((item) => ({ start: item.startTime, end: item.endTime }))
    ];

    const { totalSlots, availableSlots } = computeSlots(
      workingRanges,
      dateOnlyUTC,
      totalDuration,
      events
    );

    const nowUTC = new Date();
    const filteredSlots =
      dateOnlyUTC.getTime() === todayStartNairobiUTC.getTime()
        ? availableSlots.filter((slot) => slot.end.getTime() > nowUTC.getTime())
        : availableSlots;

    if (filteredSlots.length === 0 && dateOnlyUTC.getTime() === todayStartNairobiUTC.getTime()) {
      res.status(200).json({
        success: true,
        message: "time has passed",
        data: {
          date: dateStr,
          totalSlots,
          availableSlots: 0
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        date: dateStr,
        totalSlots,
        availableSlots: filteredSlots.length
      }
    });
  } catch (error: any) {
    console.error("Get day availability error:", error);
    next(errorHandler(500, "Server error while fetching day availability"));
  }
};
