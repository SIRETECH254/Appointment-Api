import type { Request, Response, NextFunction } from "express";
import Appointment from "../models/Appointment";
import Service from "../models/Service";
import StoreConfiguration from "../models/StoreConfiguration";
import {
  createPaymentRecord,
  initiateMpesaForAppointment,
  initiatePaystackForAppointment,
  validatePaymentAmount
} from "../services/internal/paymentService";
import { createInAppNotification } from "../utils/notificationHelper";
import { checkSlotAvailability } from "../utils/availability";
import { errorHandler } from "../middleware/errorHandler";

const calculateBookingFee = (totalAmount: number, feeType: string, feeValue: number): number => {
  if (feeType === "PERCENTAGE") {
    return Math.round((totalAmount * feeValue) / 100);
  }
  return feeValue;
};

export const createAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staffId, services, startTime, endTime } = req.body;
    const customerId = req.user?._id;

    if (!customerId || !staffId || !Array.isArray(services) || services.length === 0) {
      return next(errorHandler(400, "staffId and services are required"));
    }

    if (!startTime || !endTime) {
      return next(errorHandler(400, "startTime and endTime are required"));
    }

    const now = new Date();
    if (new Date(startTime) <= now) {
      return next(errorHandler(400, "Appointment time has passed"));
    }

    const serviceDocs = await Service.find({ _id: { $in: services }, isActive: true });
    if (serviceDocs.length !== services.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    const slotCheck = await checkSlotAvailability({
      staffId: String(staffId),
      serviceIds: services.map((id: any) => id.toString()),
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });
    if (!slotCheck.ok) {
      return next(errorHandler(400, slotCheck.message || "Appointment time is not available"));
    }

    const totalAmount = serviceDocs.reduce((sum, service) => sum + (service.fullPrice || 0), 0);
    const config = await StoreConfiguration.findOne();
    if (!config) {
      return next(errorHandler(500, "Store configuration not found"));
    }

    const bookingFeeAmount = calculateBookingFee(totalAmount, config.appointmentFeeType, config.appointmentFeeValue);
    const remainingAmount = Math.max(0, totalAmount - bookingFeeAmount);

    const appointment = await Appointment.create({
      customerId,
      staffId,
      services,
      startTime,
      endTime,
      bookingFeeAmount,
      remainingAmount,
      status: "PENDING"
    });

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("customerId", "firstName lastName email phone")
      .populate("staffId", "firstName lastName email phone")
      .populate("services", "name duration fullPrice");

    try {
      await createInAppNotification({
        recipient: String(customerId),
        recipientModel: "User",
        category: "appointment",
        subject: "Appointment booked",
        message: "Your appointment was booked successfully. Please confirm by paying the booking fee.",
        actions: [
          {
            id: "confirm_appointment",
            label: "Confirm Appointment",
            type: "api",
            endpoint: `/api/appointments/${appointment._id}/confirm`,
            method: "POST",
            variant: "primary"
          }
        ],
        context: {
          resourceId: appointment._id.toString(),
          resourceType: "appointment"
        },
        metadata: {
          appointmentId: appointment._id.toString()
        },
        io: req.app.get("io")
      });
    } catch (notificationError) {
      console.error("In-app notification error:", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Appointment created",
      data: { appointment: populatedAppointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while creating appointment"));
  }
};

export const confirmAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const { method, phone, email } = req.body;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status === "CANCELLED" || appointment.status === "NO_SHOW" || appointment.status === "COMPLETED") {
      return next(errorHandler(400, "Appointment cannot be confirmed"));
    }

    const now = new Date();
    if (appointment.startTime <= now) {
      return next(errorHandler(400, "Appointment time has passed"));
    }

    const slotCheck = await checkSlotAvailability({
      staffId: appointment.staffId.toString(),
      serviceIds: (appointment.services || []).map((id) => id.toString()),
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      excludeAppointmentId: appointment._id.toString()
    });
    if (!slotCheck.ok) {
      return next(errorHandler(400, slotCheck.message || "Appointment time is not available"));
    }

    const allowedMethods = ["MPESA", "CARD"];
    if (!allowedMethods.includes(method)) {
      return next(errorHandler(400, "Invalid payment method for confirmation"));
    }

    if (method === "MPESA" && !phone) {
      return next(errorHandler(400, "phone is required for MPESA payments"));
    }
    if (method === "CARD" && !email) {
      return next(errorHandler(400, "email is required for CARD payments"));
    }

    const bookingFeeAmount = appointment.bookingFeeAmount;
    if (!validatePaymentAmount(bookingFeeAmount, appointment, "BOOKING_FEE")) {
      return next(errorHandler(400, "Invalid booking fee amount"));
    }

    const payment = await createPaymentRecord({
      appointment,
      method,
      amount: bookingFeeAmount,
      type: "BOOKING_FEE",
      customer: req.user
    });

    let gateway: any = null;
    if (method === "MPESA") {
      gateway = await initiateMpesaForAppointment({
        appointment,
        payment,
        amount: bookingFeeAmount,
        phone
      });
    } else if (method === "CARD") {
      gateway = await initiatePaystackForAppointment({
        appointment,
        payment,
        amount: bookingFeeAmount,
        email
      });
    }

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("customerId", "firstName lastName email phone")
      .populate("staffId", "firstName lastName email phone")
      .populate("services", "name duration fullPrice");

    res.status(200).json({
      success: true,
      message: "Booking fee payment initiated",
      data: { appointment: populatedAppointment, payment, gateway }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while confirming appointment"));
  }
};

export const rescheduleAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const { startTime, endTime } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be rescheduled"));
    }

    if (!startTime || !endTime) {
      return next(errorHandler(400, "startTime and endTime are required"));
    }

    const slotCheck = await checkSlotAvailability({
      staffId: appointment.staffId.toString(),
      serviceIds: (appointment.services || []).map((id) => id.toString()),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      excludeAppointmentId: appointment._id.toString()
    });
    if (!slotCheck.ok) {
      return next(errorHandler(400, slotCheck.message || "Appointment time is not available"));
    }

    appointment.startTime = startTime;
    appointment.endTime = endTime;
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while rescheduling appointment"));
  }
};

export const cancelAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be cancelled"));
    }

    const now = new Date();
    const hoursUntilStart = (appointment.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilStart < 2) {
      return next(errorHandler(400, "Appointments can only be cancelled at least 2 hours before start time"));
    }

    appointment.status = "CANCELLED";
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment cancelled",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while cancelling appointment"));
  }
};

export const checkIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be checked in"));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(appointment.startTime);
    appointmentDate.setHours(0, 0, 0, 0);
    if (today.getTime() !== appointmentDate.getTime()) {
      return next(errorHandler(400, "Check-in is only allowed on the day of the appointment"));
    }

    appointment.checkedInAt = new Date();
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Customer checked in",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while checking in"));
  }
};

export const completeAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    appointment.status = "COMPLETED";
    appointment.actualEndTime = new Date();
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment completed",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while completing appointment"));
  }
};

export const markNoShow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be marked as no-show"));
    }

    appointment.status = "NO_SHOW";
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment marked as no-show",
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while marking no-show"));
  }
};

export const getAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, staffId, startDate, endDate } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (staffId) query.staffId = staffId;
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(String(startDate));
      if (endDate) query.startTime.$lte = new Date(String(endDate));
    }

    const appointments = await Appointment.find(query)
      .populate("customerId", "firstName lastName phone")
      .populate("staffId", "firstName lastName")
      .populate("services", "name duration fullPrice")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { appointments }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching appointments"));
  }
};

export const getMyAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, startDate, endDate } = req.query;
    const query: any = { customerId: req.user?._id };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(String(startDate));
      if (endDate) query.startTime.$lte = new Date(String(endDate));
    }

    const appointments = await Appointment.find(query)
      .populate("staffId", "firstName lastName")
      .populate("services", "name duration fullPrice")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { appointments }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching appointments"));
  }
};

export const getAppointmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId)
      .populate("customerId", "firstName lastName email phone")
      .populate("staffId", "firstName lastName email phone")
      .populate("services", "name duration fullPrice");

    if (!appointment) {
      return next(errorHandler(404, "Appointment not found"));
    }

    res.status(200).json({
      success: true,
      data: { appointment }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching appointment"));
  }
};

export const deleteAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return next(errorHandler(404, "Appointment not found"));
    }

    await Appointment.findByIdAndDelete(appointmentId);

    res.status(200).json({
      success: true,
      message: "Appointment deleted successfully",
      data: { appointmentId }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while deleting appointment"));
  }
};
