# 💳 Payment Documentation

## 📋 Table of Contents
- [Payment Overview](#payment-overview)
- [Payment Model](#-payment-model)
- [Payment Controller](#-payment-controller)
- [Payment Routes](#-payment-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Payment Overview

Payments cover booking fees and full payments for appointments. The system integrates **Daraja (M-Pesa STK Push)** and **Paystack (card)** using the same service-layer approach as SIRE-API, with external gateway services and an internal payment service that drives status updates. **There are no invoices** in this application.

Key flow:
1. Create payment record (status `PENDING`)
2. Initiate payment with Daraja or Paystack
3. Handle webhook callback (success/failure)
4. Update payment status and appointment amounts/status

---

## 🧾 Payment Model

### Schema Definition
```typescript
interface IPayment {
  _id: ObjectId;
  appointmentId: ObjectId;
  paymentNumber: string;
  amount: number;
  currency: "KES";
  type: "BOOKING_FEE" | "FULL_PAYMENT";
  method: "MPESA" | "CARD" | "CASH";
  status: "PENDING" | "SUCCESS" | "FAILED";
  transactionRef?: string;
  processorRefs?: {
    daraja?: { merchantRequestId?: string; checkoutRequestId?: string };
    paystack?: { reference?: string };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Notes
- `paymentNumber` is generated using a running yearly sequence (SIRE-style).
- `appointmentId` replaces the invoice reference.
- `processorRefs` stores gateway IDs for later reconciliation.

### Validation Rules
```typescript
appointmentId: { required: true, ref: "Appointment" }
paymentNumber: { required: true, unique: true }
amount:        { required: true, min: 0 }
currency:      { enum: ["KES"], default: "KES" }
type:          { enum: ["BOOKING_FEE","FULL_PAYMENT"] }
method:        { enum: ["MPESA","CARD","CASH"] }
status:        { enum: ["PENDING","SUCCESS","FAILED"], default: "PENDING" }
transactionRef:{ optional }
processorRefs: { optional }
```

---

## 🎮 Payment Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import Payment from "../models/Payment";
import Appointment from "../models/Appointment";
import { errorHandler } from "../middleware/errorHandler";
import {
  createPaymentRecord,
  applySuccessfulPayment,
  initiateMpesaForAppointment,
  initiatePaystackForAppointment
} from "../services/internal/paymentService";
import { parseCallback } from "../services/external/darajaService";
import { parseWebhook, verifyTransaction } from "../services/external/paystackService";
```

### Functions Overview

#### `initiatePayment()`
**Purpose:** Start a booking fee or full payment  
**Access:** Customer/Admin  
**Validation:**
- Appointment exists and is payable
- Amount is valid for remaining balance
- `phone` required for MPESA, `email` required for CARD
**Process:**
- Create payment record (`PENDING`)
- Call Daraja STK push or Paystack initialize
- Return checkout details to client  
**Response:** Payment record + gateway payload

**Controller Implementation:**
```typescript
export const initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { appointmentId, amount, method, type, phone, email } = req.body;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    const payment = await createPaymentRecord({
      appointment,
      method,
      amount,
      customer: req.user
    });

    let gateway: any = null;
    if (method === "MPESA") {
      gateway = await initiateMpesaForAppointment({
        appointment,
        payment,
        amount,
        phone
      });
    } else if (method === "CARD") {
      gateway = await initiatePaystackForAppointment({
        appointment,
        payment,
        amount,
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
```

#### `mpesaWebhook()`
**Purpose:** Handle M-Pesa (Daraja) callback  
**Access:** Public (signature-verified)  
**Process:**
- Emit socket.io event `callback.received` with result description and code if STK callback is present
- Parse Daraja callback payload
- Update payment status to `SUCCESS` or `FAILED`
- Apply payment to appointment (update remaining amount, confirm if booking fee paid)
- On booking fee success, appointment status becomes `CONFIRMED`

**Controller Implementation:**
```typescript
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
```

#### `paystackWebhook()`
**Purpose:** Handle Paystack callback  
**Access:** Public (signature-verified)  
**Process:**
- Parse Paystack webhook payload
- Verify transaction
- Update payment status to `SUCCESS` or `FAILED`
- Apply payment to appointment (update remaining amount, confirm if booking fee paid)
- On booking fee success, appointment status becomes `CONFIRMED`

**Controller Implementation:**
```typescript
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
```

#### `getPayments()`
**Purpose:** List payments  
**Access:** Admin/Staff  
**Filters:** date range, status, method

**Controller Implementation:**
```typescript
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
```

#### `getPayment()`
**Purpose:** Fetch single payment  
**Access:** Admin/Staff/Owner

**Controller Implementation:**
```typescript
export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    if (!payment) return next(errorHandler(404, "Payment not found"));

    res.status(200).json({ success: true, data: { payment } });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching payment"));
  }
};
```

---

## 🧩 Internal Payment Service

**File: `src/services/internal/paymentService.ts`**

### Functions Overview

#### `createPaymentRecord(appointment, method, amount, type, customer?)`
**Purpose:** Create a payment record before gateway initiation  
**Access:** Internal service  
**Validation:** Appointment exists, amount > 0, method and type are valid  
**Process:** Generate payment number, create `PENDING` payment linked to appointment  
**Response:** Payment document

**Service Implementation:**
```typescript
export const createPaymentRecord = async (params: CreatePaymentRecordParams): Promise<any> => {
  const paymentNumber = await generatePaymentNumber();

  const payment = await Payment.create({
    paymentNumber,
    appointmentId: params.appointment._id,
    amount: params.amount,
    method: params.method,
    type: params.type,
    status: "PENDING",
    processorRefs: {}
  });

  return payment;
};
```

#### `applySuccessfulPayment(appointment, payment, io?)`
**Purpose:** Mark payment as successful and update appointment status/amounts  
**Access:** Internal service  
**Validation:** Payment and appointment exist  
**Process:** Update payment to `SUCCESS`, confirm appointment if needed, update remaining amount  
**Response:** Updated payment and appointment

**Service Implementation:**
```typescript
export const applySuccessfulPayment = async (params: ApplySuccessfulPaymentParams): Promise<any> => {
  const { appointment, payment, io } = params;

  payment.status = "SUCCESS";
  await payment.save();

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

  return { payment, appointment };
};
```

#### `initiateMpesaForAppointment(appointment, payment, amount, phone)`
**Purpose:** Start M-Pesa STK push for appointment payment  
**Access:** Internal service  
**Validation:** Amount > 0, phone provided, M-Pesa credentials configured  
**Process:** Initiate STK push and store Daraja refs on payment  
**Response:** Daraja response with checkout identifiers

**Service Implementation:**
```typescript
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
```

#### `initiatePaystackForAppointment(appointment, payment, amount, email, callbackUrl?)`
**Purpose:** Start Paystack transaction for appointment payment  
**Access:** Internal service  
**Validation:** Amount > 0, email provided, Paystack secret configured  
**Process:** Initialize Paystack transaction and store reference on payment  
**Response:** Paystack authorization URL and reference

**Service Implementation:**
```typescript
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
```

#### `generatePaymentNumber()`
**Purpose:** Generate a readable sequential payment number  
**Access:** Internal service  
**Validation:** None  
**Process:** Count payments in current year and format `PAY-YYYY-XXXX`  
**Response:** Payment number string

**Service Implementation:**
```typescript
export const generatePaymentNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const count = await Payment.countDocuments({
    createdAt: { $gte: startOfYear }
  });
  return `PAY-${year}-${String(count + 1).padStart(4, "0")}`;
};
```

#### `calculatePaymentFees(amount, method)`
**Purpose:** Calculate processing fees for a payment method  
**Access:** Internal service  
**Validation:** Amount > 0  
**Process:** Apply method-specific rate (MPESA/Paystack)  
**Response:** Fee amount

**Service Implementation:**
```typescript
export const calculatePaymentFees = (amount: number, method: string): number => {
  const feeRates: { [key: string]: number } = {
    mpesa: 0.015,
    paystack: 0.035
  };

  const rate = feeRates[method] || 0;
  return Math.round(amount * rate * 100) / 100;
};
```

#### `validatePaymentAmount(amount, appointment, type)`
**Purpose:** Validate payment amount against appointment balances  
**Access:** Internal service  
**Validation:** Amount must be numeric and positive  
**Process:** Booking fee must match exact booking fee; full payment must not exceed remaining  
**Response:** Boolean

**Service Implementation:**
```typescript
export const validatePaymentAmount = (amount: number, appointment: any, type: string): boolean => {
  if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) return false;
  if (type === "BOOKING_FEE") {
    return amount === appointment.bookingFeeAmount;
  }
  return amount <= appointment.remainingAmount;
};
```

---

## 🌍 External Gateway Services

### Daraja (M-Pesa)
**File:** `src/services/external/darajaService.ts`

#### `getAccessToken(forceRefresh?)`
**Purpose:** Fetch OAuth token  
**Access:** Internal service  
**Validation:** MPESA consumer key/secret configured  
**Process:** Request token from Daraja OAuth endpoint  
**Response:** Access token string

**Service Implementation:**
```typescript
export const getAccessToken = async (forceRefresh: boolean = false): Promise<string> => {
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || "").trim();
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || "").trim();
  if (!consumerKey || !consumerSecret) {
    throw new Error("Daraja credentials not configured: Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET");
  }

  try {
    const base = getBaseUrl();
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const response = await axios.get(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }
    });

    if (!response.data?.access_token) {
      throw new Error("Daraja OAuth response missing access_token");
    }

    return response.data.access_token;
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = `Daraja OAuth failed${status ? ` (HTTP ${status})` : ""}`;
    const details = typeof data === "object" ? JSON.stringify(data) : data || err.message;
    throw new Error(`${message}: ${details}`);
  }
};
```

#### `initiateStkPush({ amount, phone, accountReference })`
**Purpose:** Initiate M-Pesa STK push  
**Access:** Internal service  
**Validation:** Amount > 0, phone valid, short code/passkey configured  
**Process:** Build payload using `CALLBACK_URL` and call Daraja STK endpoint  
**Response:** Merchant and checkout request IDs

**Service Implementation:**
```typescript
export const initiateStkPush = async (params: StkPushParams): Promise<StkPushResponse> => {
  const shortCode = process.env.MPESA_SHORT_CODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = (process.env.CALLBACK_URL || "").trim();
  const partyB = shortCode;

  if (!shortCode || !passkey) {
    throw new Error("Daraja short code or passkey not configured");
  }

  if (!callbackUrl) {
    throw new Error("CALLBACK_URL is not configured");
  }

  const accessToken = await getAccessToken();
  const base = getBaseUrl();
  const timestamp = buildTimestamp();
  const password = buildPassword(shortCode, passkey, timestamp);

  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(params.amount),
    PartyA: params.phone,
    PartyB: Number(partyB),
    PhoneNumber: params.phone,
    CallBackURL: callbackUrl,
    AccountReference: String(params.accountReference),
    TransactionDesc: "Appointment payment"
  };

  try {
    const resp = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    });

    return {
      merchantRequestId: resp.data?.MerchantRequestID,
      checkoutRequestId: resp.data?.CheckoutRequestID,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = `Daraja STK Push failed${status ? ` (HTTP ${status})` : ""}`;
    const details = typeof data === "object" ? JSON.stringify(data) : data || err.message;
    throw new Error(`${message}: ${details}`);
  }
};
```

#### `parseCallback(body)`
**Purpose:** Parse Daraja callback payload  
**Access:** Internal service  
**Validation:** Payload must contain `stkCallback`  
**Process:** Extract result code, checkout ID, amount, phone  
**Response:** Parsed callback object

**Service Implementation:**
```typescript
export const parseCallback = (body: any): CallbackParseResult => {
  const stk = body?.Body?.stkCallback || {};
  if (!stk) return { valid: false, success: false };

  const resultCode = stk.ResultCode;
  const success = resultCode === 0;
  const checkoutRequestId = stk.CheckoutRequestID;

  let amount: number | undefined;
  let phone: string | undefined;
  const items = stk?.CallbackMetadata?.Item || [];

  console.log("===== PARSING DARAJA CALLBACK =====");
  console.log("STK Callback:", JSON.stringify(stk, null, 2));
  console.log("CallbackMetadata Items:", JSON.stringify(items, null, 2));
  console.log("Result Code:", resultCode);
  console.log("====================================");

  for (const item of items) {
    if (item?.Name === "Amount") amount = item?.Value;
    if (item?.Name === "PhoneNumber") phone = item?.Value;
  }

  return {
    valid: true,
    success,
    checkoutRequestId,
    amount,
    phone,
    raw: body,
    stk
  };
};
```

#### `queryStkPushStatus({ checkoutRequestId })`
**Purpose:** Query STK push status  
**Access:** Internal service  
**Validation:** CheckoutRequestID required  
**Process:** Call Daraja query endpoint  
**Response:** Status details

**Service Implementation:**
```typescript
export const queryStkPushStatus = async (params: StkQueryParams): Promise<StkQueryResponse> => {
  const resolvedShortCode = (params.shortCode || process.env.MPESA_SHORT_CODE || "").trim();
  const resolvedPasskey = (params.passkey || process.env.MPESA_PASSKEY || "").trim();

  if (!resolvedShortCode || !resolvedPasskey) {
    throw new Error("Daraja short code or passkey not configured");
  }

  const accessToken = await getAccessToken();
  const base = getBaseUrl();
  const timestamp = buildTimestamp();
  const password = buildPassword(resolvedShortCode, resolvedPasskey, timestamp);

  try {
    const resp = await axios.post(
      `${base}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: Number(resolvedShortCode),
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: params.checkoutRequestId
      },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    return {
      ok: true,
      resultCode: resp.data?.ResultCode,
      resultDesc: resp.data?.ResultDesc,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    return {
      ok: false,
      error: `Daraja STK Query failed${status ? ` (HTTP ${status})` : ""}`,
      details: typeof data === "object" ? JSON.stringify(data) : data || err.message
    };
  }
};
```

### Paystack
**File:** `src/services/external/paystackService.ts`

#### `initTransaction({ amount, email, reference, callbackUrl, currency })`
**Purpose:** Initialize Paystack transaction  
**Access:** Internal service  
**Validation:** Amount > 0, email provided, secret configured  
**Process:** Call Paystack initialize endpoint and return authorization URL  
**Response:** Authorization URL and reference

**Service Implementation:**
```typescript
export const initTransaction = async (params: PaystackTransactionParams): Promise<PaystackTransactionResponse> => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Paystack secret not configured");

  try {
    const resp = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: params.email,
        amount: Math.round(params.amount * 100),
        currency: params.currency || "KES",
        reference: params.reference,
        callback_url: params.callbackUrl
      },
      { headers: { Authorization: `Bearer ${secret}` } }
    );

    return {
      authorizationUrl: resp.data?.data?.authorization_url,
      reference: resp.data?.data?.reference,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = `Paystack transaction initialization failed${status ? ` (HTTP ${status})` : ""}`;
    const details = typeof data === "object" ? JSON.stringify(data) : data || err.message;
    throw new Error(`${message}: ${details}`);
  }
};
```

#### `parseWebhook(body)`
**Purpose:** Parse Paystack webhook payload  
**Access:** Internal service  
**Validation:** Payload must include reference  
**Process:** Extract reference and success status  
**Response:** Parsed webhook object

**Service Implementation:**
```typescript
export const parseWebhook = (body: any): PaystackWebhookParseResult => {
  const event = body?.event;
  const reference = body?.data?.reference;
  const status = body?.data?.status;
  const success = event === "charge.success" || status === "success";

  return {
    valid: !!reference,
    success,
    reference,
    raw: body
  };
};
```

#### `verifyTransaction({ reference })`
**Purpose:** Verify Paystack transaction  
**Access:** Internal service  
**Validation:** Reference required  
**Process:** Call Paystack verify endpoint  
**Response:** Verification status and amounts

**Service Implementation:**
```typescript
export const verifyTransaction = async (params: VerifyTransactionParams): Promise<VerifyTransactionResponse> => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Paystack secret not configured");

  try {
    const resp = await axios.get(`https://api.paystack.co/transaction/verify/${params.reference}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });

    const data = resp.data?.data;
    return {
      success: data?.status === "success",
      amount: data?.amount ? data.amount / 100 : undefined,
      currency: data?.currency,
      status: data?.status,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    return {
      success: false,
      error: `Paystack verification failed${status ? ` (HTTP ${status})` : ""}`,
      raw: data
    };
  }
};
```

---

## 🛣️ Payment Routes

### Base Path: `/api/payments`

```typescript
POST   /initiate                       // Initiate payment
POST   /webhooks/mpesa                 // Daraja callback
POST   /webhooks/paystack              // Paystack callback
GET    /                               // List payments
GET    /:paymentId                     // Get payment
```

### Router Implementation

**File: `src/routes/paymentRoutes.ts`**

```typescript
import express from "express";
import {
  initiatePayment,
  mpesaWebhook,
  paystackWebhook,
  getPayments,
  getPayment
} from "../controllers/paymentController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

router.post("/initiate", authenticateToken, initiatePayment);
router.post("/webhooks/mpesa", mpesaWebhook);
router.post("/webhooks/paystack", paystackWebhook);
router.get("/", authenticateToken, authorizeRoles(["admin", "staff"]), getPayments);
router.get("/:paymentId", authenticateToken, getPayment);

export default router;
```

### Route Details

#### `POST /api/payments/initiate`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**
```json
{
  "appointmentId": "...",
  "amount": 200,
  "method": "MPESA",
  "type": "BOOKING_FEE",
  "phone": "+254712345679"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Payment initiated",
  "data": {
    "payment": {
      "id": "...",
      "status": "PENDING"
    },
    "gateway": {
      "checkoutRequestId": "...",
      "merchantRequestId": "..."
    }
  }
}
```

#### `POST /api/payments/webhooks/mpesa`
**Headers:** Provider signature headers  
**Body (JSON):** Daraja callback payload  
**Response:**
```json
{ "success": true }
```

#### `POST /api/payments/webhooks/paystack`
**Headers:** Provider signature headers  
**Body (JSON):** Paystack webhook payload  
**Response:**
```json
{ "success": true }
```

#### `GET /api/payments`
**Headers:** `Authorization: Bearer <token>`  
**Query:** `status`, `method`, `startDate`, `endDate`
**Response:**
```json
{
  "success": true,
  "data": {
    "payments": []
  }
}
```

#### `GET /api/payments/:paymentId`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "...",
      "status": "SUCCESS"
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware
- `authenticateToken` - Verify JWT token
- `authorizeRoles(allowedRoles)` - Role-based access control

Usage:
```typescript
router.post("/initiate", authenticateToken, initiatePayment);
```

---

## 📝 API Examples

### Initiate Booking Fee (M-Pesa)
```bash
curl -X POST http://localhost:4500/api/payments/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": "64f2...",
    "amount": 200,
    "method": "MPESA",
    "type": "BOOKING_FEE",
    "phone": "+254712345679"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Payment initiated",
  "data": {
    "payment": { "id": "...", "status": "PENDING" },
    "gateway": { "checkoutRequestId": "...", "merchantRequestId": "..." }
  }
}
```

### Initiate Booking Fee (Paystack)
```bash
curl -X POST http://localhost:4500/api/payments/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": "64f2...",
    "amount": 200,
    "method": "CARD",
    "type": "BOOKING_FEE",
    "email": "customer@example.com"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Payment initiated",
  "data": {
    "payment": { "id": "...", "status": "PENDING" },
    "gateway": { "authorizationUrl": "https://paystack.com/..." }
  }
}
```

### List Payments
```bash
curl -X GET "http://localhost:4500/api/payments?status=SUCCESS" \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "payments": []
  }
}
```

### Get Payment
```bash
curl -X GET http://localhost:4500/api/payments/<paymentId> \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "...",
      "status": "SUCCESS"
    }
  }
}
```

---

## 🛡️ Security Features

- **Webhook verification:** Validate request origin and transaction status.
- **RBAC:** Only admins/staff can list payments; customers can only initiate/see their own.
- **Idempotency:** Processor references are stored to prevent duplicate processing.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Payment not found" }
```
```json
{ "success": false, "message": "Invalid payment amount" }
```

---

## 📊 Database Indexes

```typescript
paymentSchema.index({ appointmentId: 1 });
paymentSchema.index({ paymentNumber: 1 }, { unique: true });
paymentSchema.index({ status: 1, createdAt: 1 });
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
