import Appointment from "../models/Appointment";
import BreakModel from "../models/Break";
import User from "../models/User";

type TimeRange = { start: Date; end: Date };

const getDayKey = (date: Date): string => {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()] ?? "sunday";
};

const parseTime = (time: string): { hours: number; minutes: number } | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return { hours: parseInt(match[1]!, 10), minutes: parseInt(match[2]!, 10) };
};

const combineDateAndTime = (date: Date, time: string): Date | null => {
  const parsed = parseTime(time);
  if (!parsed) return null;
  const combined = new Date(date);
  combined.setHours(parsed.hours, parsed.minutes, 0, 0);
  return combined;
};

const overlaps = (slot: TimeRange, event: TimeRange): boolean =>
  slot.start < event.end && slot.end > event.start;

const isWithinWorkingHours = (
  workingRanges: Array<{ start: string; end: string }>,
  start: Date,
  end: Date
): boolean => {
  for (const range of workingRanges) {
    const rangeStart = combineDateAndTime(start, range.start);
    const rangeEnd = combineDateAndTime(start, range.end);
    if (!rangeStart || !rangeEnd || rangeStart >= rangeEnd) {
      continue;
    }
    if (start >= rangeStart && end <= rangeEnd) {
      return true;
    }
  }
  return false;
};

export interface SlotAvailabilityParams {
  staffId: string;
  serviceIds: string[];
  startTime: Date;
  endTime: Date;
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
  const breaks = await BreakModel.find({
    staffId,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  }).select("startTime endTime");

  const events: TimeRange[] = [
    ...conflictingAppointments.map((item) => ({ start: item.startTime, end: item.endTime })),
    ...breaks.map((item) => ({ start: item.startTime, end: item.endTime }))
  ];

  const hasOverlap = events.some((event) => overlaps({ start: startTime, end: endTime }, event));
  if (hasOverlap) {
    return { ok: false, message: "Appointment time is not available" };
  }

  return { ok: true };
};
