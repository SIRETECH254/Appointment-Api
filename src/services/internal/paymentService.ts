import Payment from "../../models/Payment";
import { initiateStkPush } from "../external/darajaService";
import { initTransaction } from "../external/paystackService";

export interface CreatePaymentRecordParams {
  appointment?: any;
  method: string;
  amount: number;
  type: "BOOKING_FEE" | "FULL_PAYMENT";
  customer?: any;
}

export interface ApplySuccessfulPaymentParams {
  appointment: any;
  payment: any;
  io?: any;
}

export interface InitiateMpesaParams {
  appointment: any;
  payment: any;
  amount: number;
  phone: string;
}

export interface InitiatePaystackParams {
  appointment: any;
  payment: any;
  amount: number;
  email: string;
  callbackUrl?: string | undefined;
}

export interface InitiateMpesaForServiceParams {
  payment: any;
  amount: number;
  phone: string;
}

export interface InitiatePaystackForServiceParams {
  payment: any;
  amount: number;
  email: string;
  callbackUrl?: string | undefined;
}

export const createPaymentRecord = async (params: CreatePaymentRecordParams): Promise<any> => {
  const paymentNumber = await generatePaymentNumber();

  const payment = await Payment.create({
    paymentNumber,
    appointmentId: params.appointment?._id || null,
    amount: params.amount,
    method: params.method,
    type: params.type,
    status: "PENDING",
    processorRefs: {}
  });

  return payment;
};

export const applySuccessfulPayment = async (params: ApplySuccessfulPaymentParams): Promise<any> => {
  const { appointment, payment, io } = params;

  payment.status = "SUCCESS";
  await payment.save();

  if (appointment) {
    if (payment.type === "FULL_PAYMENT") {
      appointment.remainingAmount = 0;
      if (appointment.status === "PENDING") {
        appointment.status = "CONFIRMED";
      }
    }

    if (payment.type === "BOOKING_FEE" && appointment.status === "PENDING") {
      appointment.status = "CONFIRMED";
    }

    await appointment.save();

    if (io) {
      io.emit("payment.updated", { paymentId: payment._id.toString(), status: payment.status });
      io.emit("appointment.updated", { appointmentId: appointment._id.toString(), status: appointment.status });
    }
  } else {
    if (io) {
      io.emit("payment.updated", { paymentId: payment._id.toString(), status: payment.status });
    }
  }

  return { payment, appointment };
};

export const initiateMpesaForAppointment = async (params: InitiateMpesaParams): Promise<any> => {
  const { appointment, payment, amount, phone } = params;

  const accountReference = appointment._id.toString();
  const res = await initiateStkPush({
    amount,
    phone,
    accountReference
  });

  payment.status = "PENDING";
  if (!payment.processorRefs) payment.processorRefs = {};
  payment.processorRefs.daraja = {
    merchantRequestId: res.merchantRequestId,
    checkoutRequestId: res.checkoutRequestId
  };
  await payment.save();

  return res;
};

export const initiatePaystackForAppointment = async (params: InitiatePaystackParams): Promise<any> => {
  const { appointment, payment, amount, email, callbackUrl } = params;

  const reference = `APT-${appointment._id}-${Date.now()}`;
  const res = await initTransaction({
    amount,
    email,
    reference,
    callbackUrl: callbackUrl || undefined,
    currency: process.env.PAYSTACK_CURRENCY || "KES"
  });

  payment.status = "PENDING";
  if (!payment.processorRefs) payment.processorRefs = {};
  payment.processorRefs.paystack = { reference };
  await payment.save();

  return res;
};

export const initiateMpesaForService = async (params: InitiateMpesaForServiceParams): Promise<any> => {
  const { payment, amount, phone } = params;

  const accountReference = `SRV-${payment._id}-${Date.now()}`;
  const res = await initiateStkPush({
    amount,
    phone,
    accountReference
  });

  payment.status = "PENDING";
  if (!payment.processorRefs) payment.processorRefs = {};
  payment.processorRefs.daraja = {
    merchantRequestId: res.merchantRequestId,
    checkoutRequestId: res.checkoutRequestId
  };
  await payment.save();

  return res;
};

export const initiatePaystackForService = async (params: InitiatePaystackForServiceParams): Promise<any> => {
  const { payment, amount, email, callbackUrl } = params;

  const reference = `SRV-${payment._id}-${Date.now()}`;
  const res = await initTransaction({
    amount,
    email,
    reference,
    callbackUrl: callbackUrl || undefined,
    currency: process.env.PAYSTACK_CURRENCY || "KES"
  });

  payment.status = "PENDING";
  if (!payment.processorRefs) payment.processorRefs = {};
  payment.processorRefs.paystack = { reference };
  await payment.save();

  return res;
};

export const generatePaymentNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const count = await Payment.countDocuments({
    createdAt: { $gte: startOfYear }
  });
  return `PAY-${year}-${String(count + 1).padStart(4, "0")}`;
};

export const calculatePaymentFees = (amount: number, method: string): number => {
  const feeRates: { [key: string]: number } = {
    mpesa: 0.015,
    paystack: 0.035
  };

  const rate = feeRates[method] || 0;
  return Math.round(amount * rate * 100) / 100;
};

export const validatePaymentAmount = (amount: number, appointment: any, type: string): boolean => {
  if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) return false;
  if (type === "BOOKING_FEE") {
    return amount === appointment.bookingFeeAmount;
  }
  return amount <= appointment.remainingAmount;
};
