import type { Request, Response, NextFunction } from "express";
import Payment from "../models/Payment";
import Appointment from "../models/Appointment";
import Service from "../models/Service";
import { errorHandler } from "../middleware/errorHandler";
import {
  createPaymentRecord,
  applySuccessfulPayment,
  initiateMpesaForAppointment,
  initiatePaystackForAppointment,
  initiateMpesaForService,
  initiatePaystackForService,
  validatePaymentAmount
} from "../services/internal/paymentService";
import { parseCallback, queryStkPushStatus } from "../services/external/darajaService";
import { parseWebhook, verifyTransaction } from "../services/external/paystackService";

export const initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { services, method, phone, email } = req.body;
    if (!method) {
      return next(errorHandler(400, "method is required"));
    }

    if (!Array.isArray(services) || services.length === 0) {
      return next(errorHandler(400, "services array is required"));
    }

    const allowedMethods = ["MPESA", "CARD", "CASH"];
    if (!allowedMethods.includes(method)) {
      return next(errorHandler(400, "Invalid payment method"));
    }

    const serviceDocs = await Service.find({ _id: { $in: services }, isActive: true });
    if (serviceDocs.length !== services.length) {
      return next(errorHandler(404, "One or more services not found"));
    }

    const totalAmount = serviceDocs.reduce((sum, service) => sum + (service.fullPrice || 0), 0);
    if (totalAmount <= 0) {
      return next(errorHandler(400, "Invalid payment amount"));
    }

    if (method === "MPESA" && !phone) {
      return next(errorHandler(400, "phone is required for MPESA payments"));
    }
    if (method === "CARD" && !email) {
      return next(errorHandler(400, "email is required for CARD payments"));
    }

    const payment = await createPaymentRecord({
      appointment: null,
      method,
      amount: totalAmount,
      type: "FULL_PAYMENT",
      customer: req.user
    });

    let gateway: any = null;
    if (method === "MPESA") {
      gateway = await initiateMpesaForService({
        payment,
        amount: totalAmount,
        phone
      });
    } else if (method === "CARD") {
      gateway = await initiatePaystackForService({
        payment,
        amount: totalAmount,
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

export const servicePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId, method, phone, email } = req.body;
    if (!appointmentId || !method) {
      return next(errorHandler(400, "appointmentId and method are required"));
    }

    const allowedMethods = ["MPESA", "CARD", "CASH"];
    if (!allowedMethods.includes(method)) {
      return next(errorHandler(400, "Invalid payment method"));
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    if (appointment.remainingAmount <= 0) {
      return next(errorHandler(400, "No remaining amount to pay"));
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
      amount: appointment.remainingAmount,
      type: "FULL_PAYMENT",
      customer: req.user
    });

    let gateway: any = null;
    if (method === "MPESA") {
      gateway = await initiateMpesaForAppointment({
        appointment,
        payment,
        amount: appointment.remainingAmount,
        phone
      });
    } else if (method === "CARD") {
      gateway = await initiatePaystackForAppointment({
        appointment,
        payment,
        amount: appointment.remainingAmount,
        email
      });
    }

    res.status(200).json({
      success: true,
      message: "Service payment initiated",
      data: { payment, gateway }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while initiating service payment"));
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

    payment.transactionRef = parsed.checkoutRequestId;
    
    if (payment.appointmentId) {
      const appointment = await Appointment.findById(payment.appointmentId);
      if (!appointment) {
        res.status(200).json({ success: false });
        return;
      }
      await applySuccessfulPayment({ appointment, payment, io });
    } else {
      await applySuccessfulPayment({ appointment: null, payment, io });
    }
    
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

    payment.transactionRef = parsed.reference;
    
    if (payment.appointmentId) {
      const appointment = await Appointment.findById(payment.appointmentId);
      if (!appointment) {
        res.status(200).json({ success: false });
        return;
      }
      await applySuccessfulPayment({ appointment, payment, io: req.app.get("io") });
    } else {
      await applySuccessfulPayment({ appointment: null, payment, io: req.app.get("io") });
    }
    
    res.status(200).json({ success: true });
  } catch (error: any) {
    next(errorHandler(500, "Server error while processing Paystack webhook"));
  }
};

export const getPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, method, startDate, endDate, page = 1, limit = 10 } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (method) query.method = method;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(String(startDate));
      if (endDate) query.createdAt.$lte = new Date(String(endDate));
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query payments with pagination
    const payments = await Payment.find(query)
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalPayments: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
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

/**
 * Check M-Pesa STK push payment status using checkoutRequestId
 * Queries Daraja API to get the current status of an STK push transaction
 * 
 * @param req - Express request object with checkoutRequestId in params or query
 * @param res - Express response object
 * @param next - Express next function
 */
export const checkPaymentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get checkoutRequestId from params or query
    const checkoutRequestId = req.params.checkoutRequestId || req.query.checkoutRequestId;
    
    if (!checkoutRequestId || typeof checkoutRequestId !== "string") {
      return next(errorHandler(400, "checkoutRequestId is required"));
    }

    // Find payment by checkoutRequestId
    const payment = await Payment.findOne({ 
      "processorRefs.daraja.checkoutRequestId": checkoutRequestId 
    });
    
    if (!payment) {
      return next(errorHandler(404, "Payment not found for this checkoutRequestId"));
    }

    // Query Daraja API for STK push status
    const statusResult = await queryStkPushStatus({ checkoutRequestId });

    // Return payment details along with status query result
    res.status(200).json({
      success: true,
      data: {
        payment: {
          id: payment._id,
          paymentNumber: payment.paymentNumber,
          amount: payment.amount,
          status: payment.status,
          method: payment.method,
          type: payment.type,
          createdAt: payment.createdAt
        },
        status: {
          ok: statusResult.ok,
          resultCode: statusResult.resultCode,
          resultDesc: statusResult.resultDesc,
          error: statusResult.error,
          details: statusResult.details
        }
      }
    });
  } catch (error: any) {
    console.error("Check payment status error:", error);
    next(errorHandler(500, "Server error while checking payment status"));
  }
};
