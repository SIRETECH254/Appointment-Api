import Appointment from "../models/Appointment";
import BreakModel from "../models/Break";
import User from "../models/User";

type TimeRange = { start: Date; end: Date };

// Nairobi is UTC+3
// Nairobi is UTC+3. Store configuration's businessHoursTimezone is "Africa/Nairobi".
const NAIROBI_TZ_OFFSET_HOURS = 3;

// Helper to get the day of the week, considering Nairobi's timezone for a given UTC date.
export const getDayKey = (dateUTC: Date): string => {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  // Adjust the UTC date to Nairobi's day before getting the day of the week
  const dateInNairobi = new Date(dateUTC.getTime() + NAIROBI_TZ_OFFSET_HOURS * 3600 * 1000);
  return days[dateInNairobi.getUTCDay()] ?? "sunday"; // Using getUTCDay() on the adjusted date
};

const parseTime = (time: string): { hours: number; minutes: number } | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return { hours: parseInt(match[1]!, 10), minutes: parseInt(match[2]!, 10) };
};

// Parses a YYYY-MM-DD date string, interprets it as Nairobi local midnight,
// and returns the corresponding UTC Date object.
export const parseNairobiDateToUTC = (dateStr: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  // Construct a date string with explicit Nairobi offset
  // e.g., "2026-01-25T00:00:00+03:00"
  const parsed = new Date(`${dateStr}T00:00:00+03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Combines a UTC base date (representing a day) with a time string (HH:MM, Nairobi local)
// and returns the corresponding UTC Date object.
export const combineNairobiDateAndTimeToUTC = (baseDateUTC: Date, timeString: string): Date | null => {
  const parsedTime = parseTime(timeString);
  if (!parsedTime) return null;

  const combined = new Date(baseDateUTC.getTime());
  // Set the hours and minutes in UTC, adjusted by Nairobi's offset.
  // Example: if baseDateUTC represents 2026-01-25T00:00:00 EAT (which is 2026-01-24T21:00:00Z UTC)
  // And timeString is "09:00", we want 2026-01-25T09:00:00 EAT (which is 2026-01-25T06:00:00Z UTC)
  // So we add (parsedTime.hours - NAIROBI_TZ_OFFSET_HOURS) to the UTC hours.
  combined.setUTCHours(parsedTime.hours - NAIROBI_TZ_OFFSET_HOURS, parsedTime.minutes, 0, 0);

  return combined;
};


const overlaps = (slot: TimeRange, event: TimeRange): boolean =>
  slot.start < event.end && slot.end > event.start;

const isWithinWorkingHours = (
  workingRanges: Array<{ start: string; end: string }>,
  targetTimeUTC: Date, // A point in time for which we check if it's within working hours
  targetEndTimeUTC: Date
): boolean => {
  for (const range of workingRanges) {
    // Both rangeStart and rangeEnd must be UTC dates representing Nairobi local times
    const rangeStart = combineNairobiDateAndTimeToUTC(targetTimeUTC, range.start);
    const rangeEnd = combineNairobiDateAndTimeToUTC(targetTimeUTC, range.end);
    if (!rangeStart || !rangeEnd || rangeStart >= rangeEnd) {
      continue;
    }
    // All comparisons now happen in UTC
    if (targetTimeUTC.getTime() >= rangeStart.getTime() && targetEndTimeUTC.getTime() <= rangeEnd.getTime()) {
      return true;
    }
  }
  return false;
};

// Builds a UTC date range representing the start and end of a specific Nairobi day.
export const buildNairobiDayRangeUTC = (dateUTC: Date): { start: Date; end: Date } => {
  // 'dateUTC' here is expected to be a UTC date corresponding to midnight Nairobi time
  const start = new Date(dateUTC.getTime());
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 1); // Move to the next UTC day
  return { start, end };
};

export const startOfTodayNairobiUTC = (): Date => {
  const now = new Date();
  // Get current time in Nairobi's perspective
  const nowInNairobi = new Date(now.getTime() + NAIROBI_TZ_OFFSET_HOURS * 3600 * 1000);
  // Set to midnight in Nairobi's perspective (UTC components relative to Nairobi day)
  nowInNairobi.setUTCHours(0, 0, 0, 0);
  // Convert back to true UTC instant
  return new Date(nowInNairobi.getTime() - NAIROBI_TZ_OFFSET_HOURS * 3600 * 1000);
};

export interface SlotAvailabilityParams {
  staffId: string;
  serviceIds: string[];
  startTime: Date; // UTC date, representing Nairobi local time
  endTime: Date;   // UTC date, representing Nairobi local time
  excludeAppointmentId?: string;
}

export interface SlotAvailabilityResult {
  ok: boolean;
  message?: string;
}

export const checkSlotAvailability = async (
  params: SlotAvailabilityParams
): Promise<SlotAvailabilityResult> => {
  const { staffId, serviceIds, startTime, endTime, excludeAppointmentId } = params;

  const staff = await User.findById(staffId).select("workingHours services");
  if (!staff) {
    return { ok: false, message: "Staff not found" };
  }

  const staffServiceIds = (staff.services || []).map((id) => id.toString());
  const hasAllServices = serviceIds.every((id) => staffServiceIds.includes(id));
  if (!hasAllServices) {
    return { ok: false, message: "Staff does not provide requested services" };
  }

  // startTime is already a UTC date representing Nairobi local
  const dayKey = getDayKey(startTime);
  const workingRanges = staff.workingHours?.[dayKey as keyof typeof staff.workingHours] || [];
  if (!workingRanges || workingRanges.length === 0) {
    return { ok: false, message: "No working hours for staff on this day" };
  }

  if (!isWithinWorkingHours(workingRanges, startTime, endTime)) {
    return { ok: false, message: "Appointment time is outside working hours" };
  }
  const appointmentQuery: any = {
    staffId,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
    status: { $in: ["CONFIRMED", "COMPLETED"] }
  };
  if (excludeAppointmentId) {
    appointmentQuery._id = { $ne: excludeAppointmentId };
  }

  const conflictingAppointments = await Appointment.find(appointmentQuery).select("startTime endTime");
  
  // Fetch all breaks for the staff (time-only strings)
  const breaks = await BreakModel.find({ staffId }).select("startTime endTime");
  
  // Get the base date from startTime (representing the day in Nairobi timezone)
  // We need to extract the date part to combine with break times
  const dateOnlyUTC = new Date(startTime);
  dateOnlyUTC.setUTCHours(0, 0, 0, 0);
  // Adjust to Nairobi midnight
  dateOnlyUTC.setUTCHours(dateOnlyUTC.getUTCHours() - NAIROBI_TZ_OFFSET_HOURS);
  
  // Convert break time strings to date-time ranges for this specific day
  const breakEvents: TimeRange[] = breaks
    .map((breakItem) => {
      const breakStart = combineNairobiDateAndTimeToUTC(dateOnlyUTC, breakItem.startTime);
      const breakEnd = combineNairobiDateAndTimeToUTC(dateOnlyUTC, breakItem.endTime);
      if (!breakStart || !breakEnd) return null;
      
      // Only include breaks that overlap with working hours for this day
      const overlapsWithWorkingHours = workingRanges.some((range) => {
        const rangeStart = combineNairobiDateAndTimeToUTC(dateOnlyUTC, range.start);
        const rangeEnd = combineNairobiDateAndTimeToUTC(dateOnlyUTC, range.end);
        if (!rangeStart || !rangeEnd) return false;
        // Check if break overlaps with any working hour range
        return breakStart < rangeEnd && breakEnd > rangeStart;
      });
      
      return overlapsWithWorkingHours ? { start: breakStart, end: breakEnd } : null;
    })
    .filter((event): event is TimeRange => event !== null);

  const events: TimeRange[] = [
    ...conflictingAppointments.map((item) => ({ start: item.startTime, end: item.endTime })),
    ...breakEvents
  ];

  const hasOverlap = events.some((event) => overlaps({ start: startTime, end: endTime }, event));
  if (hasOverlap) {
    return { ok: false, message: "Appointment time is not available" };
  }

  return { ok: true };
};
