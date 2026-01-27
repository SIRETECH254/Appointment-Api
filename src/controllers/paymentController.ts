import type { Request, Response, NextFunction } from "express";
import Payment from "../models/Payment";
import Appointment from "../models/Appointment";
import { errorHandler } from "../middleware/errorHandler";
import {
  createPaymentRecord,
  applySuccessfulPayment,
  initiateMpesaForAppointment,
  initiatePaystackForAppointment,
  validatePaymentAmount
} from "../services/internal/paymentService";
import { parseCallback } from "../services/external/darajaService";
import { parseWebhook, verifyTransaction } from "../services/external/paystackService";

export const initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId, amount, method, type, phone, email } = req.body;
    if (!appointmentId || !method || !type) {
      return next(errorHandler(400, "appointmentId, method, and type are required"));
    }

    const allowedMethods = ["MPESA", "CARD", "CASH"];
    const allowedTypes = ["BOOKING_FEE", "FULL_PAYMENT"];
    if (!allowedMethods.includes(method)) {
      return next(errorHandler(400, "Invalid payment method"));
    }
    if (!allowedTypes.includes(type)) {
      return next(errorHandler(400, "Invalid payment type"));
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    const resolvedAmount = type === "BOOKING_FEE" && !amount ? appointment.bookingFeeAmount : amount;
    if (!validatePaymentAmount(resolvedAmount, appointment, type)) {
      return next(errorHandler(400, "Invalid payment amount"));
    }

    if (method === "MPESA" && !phone) {
      return next(errorHandler(400, "phone is required for MPESA payments"));
    }
    if (method === "CARD" && !email) {
      return next(errorHandler(400, "email is required for CARD payments"));
    }

    const payment = await createPaymentRecord({
      appointment,
      method,
      amount: resolvedAmount,
      type,
      customer: req.user
    });

    let gateway: any = null;
    if (method === "MPESA") {
      gateway = await initiateMpesaForAppointment({
        appointment,
        payment,
        amount: resolvedAmount,
        phone
      });
    } else if (method === "CARD") {
      gateway = await initiatePaystackForAppointment({
        appointment,
        payment,
        amount: resolvedAmount,
        email
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment initiated",
      data: { payment, gateway }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while initiating payment"));
  }
};

export const mpesaWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const io = req.app.get("io");
    const payload = req.body;

    if (payload?.Body?.stkCallback) {
      io?.emit("callback.received", {
        message: payload?.Body?.stkCallback.ResultDesc,
        code: payload?.Body?.stkCallback.ResultCode
      });
    }

    const parsed = parseCallback(payload);
    if (!parsed.valid || !parsed.checkoutRequestId) {
      res.status(200).json({ success: false });
      return;
    }

    const payment = await Payment.findOne({ "processorRefs.daraja.checkoutRequestId": parsed.checkoutRequestId });
    if (!payment) {
      res.status(200).json({ success: false });
      return;
    }

    if (!parsed.success) {
      payment.status = "FAILED";
      await payment.save();
      res.status(200).json({ success: true });
      return;
    }

    const appointment = await Appointment.findById(payment.appointmentId);
    if (!appointment) {
      res.status(200).json({ success: false });
      return;
    }

    payment.transactionRef = parsed.checkoutRequestId;
    await applySuccessfulPayment({ appointment, payment, io });
    res.status(200).json({ success: true });
  } catch (error: any) {
    next(errorHandler(500, "Server error while processing M-Pesa webhook"));
  }
};

export const paystackWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = parseWebhook(req.body);
    if (!parsed.valid || !parsed.reference) {
      res.status(200).json({ success: false });
      return;
    }

    const payment = await Payment.findOne({ "processorRefs.paystack.reference": parsed.reference });
    if (!payment) {
      res.status(200).json({ success: false });
      return;
    }

    const verification = await verifyTransaction({ reference: parsed.reference });
    if (!verification.success) {
      payment.status = "FAILED";
      await payment.save();
      res.status(200).json({ success: true });
      return;
    }

    const appointment = await Appointment.findById(payment.appointmentId);
    if (!appointment) {
      res.status(200).json({ success: false });
      return;
    }

    payment.transactionRef = parsed.reference;
    await applySuccessfulPayment({ appointment, payment, io: req.app.get("io") });
    res.status(200).json({ success: true });
  } catch (error: any) {
    next(errorHandler(500, "Server error while processing Paystack webhook"));
  }
};

export const getPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, method, startDate, endDate } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (method) query.method = method;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(String(startDate));
      if (endDate) query.createdAt.$lte = new Date(String(endDate));
    }

    const payments = await Payment.find(query).sort({ createdAt: "desc" });
    res.status(200).json({ success: true, data: { payments } });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching payments"));
  }
};

export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    if (!payment) return next(errorHandler(404, "Payment not found"));

    const roleNames = req.user?.roleNames || [];
    const isPrivileged = roleNames.includes("admin") || roleNames.includes("staff");
    if (!isPrivileged) {
      const appointment = await Appointment.findById(payment.appointmentId).select("customerId");
      if (!appointment || appointment.customerId.toString() !== req.user?._id.toString()) {
        return next(errorHandler(403, "Access denied"));
      }
    }

    res.status(200).json({ success: true, data: { payment } });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching payment"));
  }
};
