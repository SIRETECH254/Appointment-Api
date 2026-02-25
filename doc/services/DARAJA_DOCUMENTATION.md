# 💰 Appointment API - Daraja (M-Pesa) Documentation

## 📋 Table of Contents
- [Daraja Overview](#daraja-overview)
- [Configuration](#configuration)
- [Key Functions/Service Methods](#key-functionsservice-methods)
- [Usage in Internal Services](#usage-in-internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Callbacks and Webhooks](#callbacks-and-webhooks)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)

---

## Daraja Overview

Daraja is the API gateway for M-Pesa, a mobile money transfer service in Kenya. In this project, the Daraja API is integrated to facilitate M-Pesa payments for appointments, specifically using the STK Push (Sim Tool Kit Push) functionality. This allows users to confirm payments directly from their mobile phones.

**Key Features:**
-   **STK Push Initiation:** Programmatically trigger M-Pesa STK Push prompts on user phones.
-   **Transaction Callbacks:** Receive real-time notifications for payment success or failure.
-   **Transaction Status Query:** Check the status of an STK Push transaction.
-   **Secure Authentication:** Uses OAuth 2.0 for API access.

---

## Configuration

Daraja API credentials and settings are managed through environment variables and configured in `src/services/external/darajaService.ts`.

**Environment Variables:**
-   `MPESA_ENV`: `sandbox` or `production`. Determines the base URL for Daraja API.
-   `MPESA_CONSUMER_KEY`: Your M-Pesa app consumer key.
-   `MPESA_CONSUMER_SECRET`: Your M-Pesa app consumer secret.
-   `MPESA_SHORT_CODE`: The M-Pesa Pay Bill or Buy Goods short code.
-   `MPESA_PASSKEY`: The M-Pesa STK Push Passkey.
-   `CALLBACK_URL`: The URL endpoint for receiving M-Pesa transaction callbacks (webhooks). This must be publicly accessible.

**File: `src/services/external/darajaService.ts` - Configuration Snippet**
```typescript
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string
});
```
*(Note: The above snippet is for Cloudinary configuration. Daraja's internal configuration happens via environment variables directly consumed by the service functions.)*

---

## Key Functions/Service Methods

The `src/services/external/darajaService.ts` file provides the core functions for interacting with the Daraja API.

**`getAccessToken`**
Fetches an OAuth access token required for authenticating subsequent Daraja API calls.
```typescript
export const getAccessToken = async (forceRefresh: boolean = false): Promise<string> => {
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || "").trim();
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || "").trim();

  if (!consumerKey || !consumerSecret) {
    throw new Error("Daraja credentials not configured: Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET");
  }

  const base = getBaseUrl();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  try {
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

**`normalizePhoneNumber`**
Helper function to convert various Kenyan phone number formats (e.g., 07..., +2547...) into the 254XXXXXXXXX format required by Daraja.
```typescript
export const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digitsOnly = String(phone).replace(/[^0-9]/g, "");
  let msisdn = digitsOnly;

  // If starts with 0, replace with 254
  if (msisdn.startsWith("0")) {
    msisdn = `254${msisdn.slice(1)}`;
  }

  // If doesn't start with 254, check if original had 254
  if (!msisdn.startsWith("254")) {
    if (digitsOnly.startsWith("254")) {
      msisdn = digitsOnly;
    } else {
      // If it's a 9-digit number, assume it's missing the 254 prefix
      if (digitsOnly.length === 9) {
        msisdn = `254${digitsOnly}`;
      }
    }
  }

  // Validate format: 254 followed by 9 digits
  if (!/^254\d{9}$/.test(msisdn)) {
    throw new Error(`Invalid Kenyan phone format. Expected format: 254XXXXXXXXX, received: ${phone}`);
  }

  return msisdn;
};
```

**`initiateStkPush`**
Initiates an M-Pesa STK Push transaction on the user's phone.
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

  const normalizedPhone = normalizePhoneNumber(params.phone);

  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(params.amount),
    PartyA: normalizedPhone,
    PartyB: Number(partyB),
    PhoneNumber: normalizedPhone,
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

**`parseCallback`**
Parses the incoming Daraja callback (webhook) payload to extract relevant transaction details.
```typescript
export const parseCallback = (body: any): CallbackParseResult => {
  const stk = body?.Body?.stkCallback || {};
  if (!stk) return { valid: false, success: false };

  const resultCode = stk.ResultCode;
  // Handle resultCode as string or number (Daraja may return "0" or 0)
  const success = String(resultCode) === "0";
  const checkoutRequestId = stk.CheckoutRequestID;

  let amount: number | undefined;
  let phone: string | undefined;
  const items = stk?.CallbackMetadata?.Item || [];

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

**`queryStkPushStatus`**
Queries the status of a previously initiated STK Push transaction using its `checkoutRequestId`.
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
      error: `Daraja STK Query failed\${status ? ` (HTTP \${status})` : ""}`,
      details: typeof data === "object" ? JSON.stringify(data) : data || err.message
    };
  }
};
```

---

## Usage in Internal Services

The internal payment service (`src/services/internal/paymentService.ts`) utilizes Daraja functions to initiate and manage M-Pesa transactions.

**File: `src/services/internal/paymentService.ts` - Snippets**

```typescript
import { initiateStkPush } from "../external/darajaService";

// ... inside initiateMpesaForAppointment function
const res = await initiateStkPush({
  appointment,
  payment,
  amount: bookingFeeAmount,
  phone
});

// ... inside initiateMpesaForService function
const res = await initiateStkPush({
  payment,
  amount: totalAmount,
  phone
});
```

---

## Usage in Controllers

The payment controller (`src/controllers/paymentController.ts`) directly handles M-Pesa webhooks and allows checking of STK Push status.

**File: `src/controllers/paymentController.ts` - Snippets**

```typescript
import { parseCallback, queryStkPushStatus } from "../services/external/darajaService";

// ... inside mpesaWebhook function
const parsed = parseCallback(payload);

// ... inside checkPaymentStatus function
const statusResult = await queryStkPushStatus({ checkoutRequestId });
```

---

## Callbacks and Webhooks

The Daraja API relies on callbacks (webhooks) to notify the application of transaction outcomes. The `mpesaWebhook` controller function (`src/controllers/paymentController.ts`) is configured as the `CallBackURL` for STK Push transactions.

**File: `src/controllers/paymentController.ts` - `mpesaWebhook` function**
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

---

## Error Handling

All Daraja service functions are wrapped in `try-catch` blocks to handle API errors and network issues. Custom error messages are generated to provide informative feedback. The `errorHandler` middleware is used to standardize error responses.

---

## API Examples

**Initiate M-Pesa Payment (Service-Only)**

```bash
curl -X POST http://localhost:4500/api/payments/initiate 
  -H "Authorization: Bearer <token>" 
  -H "Content-Type: application/json" 
  -d '{
    "services": ["<serviceId1>", "<serviceId2>"],
    "method": "MPESA",
    "phone": "+2547XXXXXXXX"
  }'
```

**Initiate M-Pesa Payment (For Remaining Appointment Amount)**

```bash
curl -X POST http://localhost:4500/api/payments/service-payment 
  -H "Authorization: Bearer <token>" 
  -H "Content-Type: application/json" 
  -d '{
    "appointmentId": "<appointmentId>",
    "method": "MPESA",
    "phone": "+2547XXXXXXXX"
  }'
```

**Check M-Pesa STK Push Status**

```bash
curl -X GET http://localhost:4500/api/payments/status/<checkoutRequestId> 
  -H "Authorization: Bearer <token>"
```

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** Appointment API Development Team
