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

    // Log the full payload for debugging
    console.log('===== M-PESA WEBHOOK RECEIVED =====');
    console.log('Full payload:', JSON.stringify(payload, null, 2));
    console.log('Body.stkCallback:', JSON.stringify(payload?.Body?.stkCallback, null, 2));
    console.log('CallbackMetadata:', JSON.stringify(payload?.Body?.stkCallback?.CallbackMetadata, null, 2));
    console.log('====================================');

    if (payload?.Body?.stkCallback) {
      io?.emit("callback.received", {
        message: payload?.Body?.stkCallback.ResultDesc,
        code: payload?.Body?.stkCallback.ResultCode
      });
    }

    const parsed = parseCallback(payload);
    console.log('Parsed callback result:', JSON.stringify(parsed, null, 2));
    console.log('this is daraja callback');
    
    if (!parsed.valid || !parsed.checkoutRequestId) {
      console.log('❌ Invalid payload or missing checkoutRequestId');
      res.status(200).json({ success: false });
      return;
    }

    console.log('🔍 Looking for payment with checkoutRequestId:', parsed.checkoutRequestId);
    const payment = await Payment.findOne({ "processorRefs.daraja.checkoutRequestId": parsed.checkoutRequestId });
    if (!payment) {
      console.log('❌ Payment not found for checkoutRequestId:', parsed.checkoutRequestId);
      res.status(200).json({ success: false });
      return;
    }

    console.log('✅ Payment found:', payment._id.toString(), 'Status:', payment.status);

    if (!parsed.success) {
      console.log('❌ Payment failed. ResultCode:', payload?.Body?.stkCallback?.ResultCode);
      payment.status = "FAILED";
      await payment.save();
      res.status(200).json({ success: true });
      return;
    }

    payment.transactionRef = parsed.checkoutRequestId;
    console.log('✅ Payment successful. Processing payment...');
    
    if (payment.appointmentId) {
      console.log('📅 Payment linked to appointment:', payment.appointmentId);
      const appointment = await Appointment.findById(payment.appointmentId);
      if (!appointment) {
        console.log('❌ Appointment not found:', payment.appointmentId);
        res.status(200).json({ success: false });
        return;
      }
      await applySuccessfulPayment({ appointment, payment, io });
      console.log('✅ Payment applied to appointment successfully');
    } else {
      console.log('💳 Service-only payment (no appointment)');
      await applySuccessfulPayment({ appointment: null, payment, io });
      console.log('✅ Service payment processed successfully');
    }
    
    console.log('✅ Webhook processing completed successfully');
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('❌ ERROR in M-Pesa webhook handler:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
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
      .populate("customerId", "firstName lastName email phone")
      .populate("appointmentId", "startTime status")
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

export const getMyPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, method, startDate, endDate, page = 1, limit = 10 } = req.query;
    const query: any = { customerId: req.user?._id };
    
    if (status) query.status = status;
    if (method) query.method = method;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(String(startDate));
      if (endDate) query.createdAt.$lte = new Date(String(endDate));
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    const payments = await Payment.find(query)
      .populate("customerId", "firstName lastName email phone")
      .populate("appointmentId", "startTime status")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

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
    next(errorHandler(500, "Server error while fetching your payments"));
  }
};

export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId)
      .populate("customerId", "firstName lastName email phone")
      .populate("appointmentId");
    if (!payment) return next(errorHandler(404, "Payment not found"));

    const roleNames = req.user?.roleNames || [];
    const isPrivileged = roleNames.includes("admin") || roleNames.includes("staff");
    
    // Get the actual customer ID string for comparison, whether populated or not
    const paymentCustomerId = payment.customerId && (payment.customerId as any)._id 
      ? (payment.customerId as any)._id.toString() 
      : payment.customerId?.toString();
    
    if (!isPrivileged && (!paymentCustomerId || paymentCustomerId !== req.user?._id.toString())) {
      return next(errorHandler(403, "Access denied"));
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

    // Proactively update payment if we have a definitive result from Daraja
    if (statusResult.ok && statusResult.resultCode !== undefined) {
      const io = req.app.get("io");
      // Convert resultCode to string for comparison (handles both "0" and 0)
      const resultCodeStr = String(statusResult.resultCode);
      
      if (resultCodeStr === "0") {
        // Success - update payment and appointment if not already SUCCESS
        if (payment.status !== "SUCCESS") {
          if (payment.appointmentId) {
            const appointment = await Appointment.findById(payment.appointmentId);
            if (appointment) {
              await applySuccessfulPayment({ appointment, payment, io });
            }
          } else {
            await applySuccessfulPayment({ appointment: null, payment, io });
          }
        }
      } else {
        // Failure (codes like "1032", "1", etc.) - only update if still PENDING
        if (payment.status === "PENDING") {
          payment.status = "FAILED";
          await payment.save();
          io?.emit("payment.updated", { paymentId: payment._id.toString(), status: "FAILED" });
        }
      }
    }

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
