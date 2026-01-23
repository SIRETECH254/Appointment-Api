import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import StoreConfiguration from "../models/StoreConfiguration";

const validateReminderTimes = (reminderTimes: unknown): string | null => {
  if (!Array.isArray(reminderTimes)) {
    return "Reminder times must be an array of minutes";
  }
  if (reminderTimes.some((value) => typeof value !== "number" || value < 0)) {
    return "Reminder times must be zero or positive numbers";
  }
  return null;
};

// Public: fetch the single store configuration
export const getStoreConfiguration = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let storeConfiguration = await StoreConfiguration.findOne().sort({ createdAt: -1 });

    if (!storeConfiguration) {
      storeConfiguration = new StoreConfiguration();
      await storeConfiguration.save();
    }

    res.status(200).json({
      success: true,
      data: { storeConfiguration }
    });
  } catch (error: any) {
    console.error("Get store configuration error:", error);
    next(errorHandler(500, "Server error while fetching store configuration"));
  }
};

// Admin: update the single store configuration
export const updateStoreConfiguration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      appointmentFeeType,
      appointmentFeeValue,
      currency,
      minBookingNotice,
      lateGracePeriod,
      allowWalkIns,
      notificationSettings,
      businessHoursTimezone
    } = req.body;

    if (notificationSettings !== undefined && typeof notificationSettings !== "object") {
      return next(errorHandler(400, "Notification settings must be an object"));
    }

    if (notificationSettings?.reminderTimes !== undefined) {
      const reminderError = validateReminderTimes(notificationSettings.reminderTimes);
      if (reminderError) {
        return next(errorHandler(400, reminderError));
      }
    }

    let storeConfiguration = await StoreConfiguration.findOne().sort({ createdAt: -1 });
    if (!storeConfiguration) {
      storeConfiguration = new StoreConfiguration();
    }

    if (appointmentFeeType !== undefined) storeConfiguration.appointmentFeeType = appointmentFeeType;
    if (appointmentFeeValue !== undefined) storeConfiguration.appointmentFeeValue = appointmentFeeValue;
    if (currency !== undefined) storeConfiguration.currency = currency;
    if (minBookingNotice !== undefined) storeConfiguration.minBookingNotice = minBookingNotice;
    if (lateGracePeriod !== undefined) storeConfiguration.lateGracePeriod = lateGracePeriod;
    if (allowWalkIns !== undefined) storeConfiguration.allowWalkIns = allowWalkIns;
    if (businessHoursTimezone !== undefined) {
      storeConfiguration.businessHoursTimezone = businessHoursTimezone;
    }

    if (notificationSettings !== undefined) {
      if (notificationSettings.sendSMS !== undefined) {
        storeConfiguration.notificationSettings.sendSMS = notificationSettings.sendSMS;
      }
      if (notificationSettings.sendEmail !== undefined) {
        storeConfiguration.notificationSettings.sendEmail = notificationSettings.sendEmail;
      }
      if (notificationSettings.sendPush !== undefined) {
        storeConfiguration.notificationSettings.sendPush = notificationSettings.sendPush;
      }
      if (notificationSettings.reminderTimes !== undefined) {
        storeConfiguration.notificationSettings.reminderTimes = notificationSettings.reminderTimes;
      }
    }

    await storeConfiguration.save();

    res.status(200).json({
      success: true,
      message: "Store configuration updated successfully",
      data: { storeConfiguration }
    });
  } catch (error: any) {
    console.error("Update store configuration error:", error);
    next(errorHandler(500, "Server error while updating store configuration"));
  }
};
