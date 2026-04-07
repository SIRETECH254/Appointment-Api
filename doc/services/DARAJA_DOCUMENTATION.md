# 💰 Appointment API - Daraja (M-Pesa) Documentation

## 📋 Table of Contents
- [Daraja Overview](#daraja-overview)
- [Configuration](#configuration)
- [External Services](#external-services)
- [Internal Services](#internal-services)
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

Daraja API credentials and settings are managed through environment variables. These are consumed by `src/services/external/darajaService.ts` to authenticate with Safaricom and handle transaction callbacks.

**Environment Variables:**
-   `MPESA_ENV`: `sandbox` or `production`. Determines the base URL for Daraja API.
-   `MPESA_CONSUMER_KEY`: Your M-Pesa app consumer key.
-   `MPESA_CONSUMER_SECRET`: Your M-Pesa app consumer secret.
-   `MPESA_SHORT_CODE`: The M-Pesa Pay Bill or Buy Goods short code.
-   `MPESA_PASSKEY`: The M-Pesa STK Push Passkey.
-   `CALLBACK_URL` or `API_BASE_URL`: The base URL of your API server used to construct the webhook endpoint (`/api/payments/webhooks/mpesa`).

---

## External Services

The `src/services/external/darajaService.ts` file provides the core functions for direct interaction with the Safaricom Daraja API.

**`initiateStkPush`**
Handles the STK Push request payload and communication with Safaricom.

```typescript
export const initiateStkPush = async (params: StkPushParams): Promise<StkPushResponse> => {
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
    PartyA: normalizePhoneNumber(params.phone),
    PartyB: Number(shortCode),
    PhoneNumber: normalizePhoneNumber(params.phone),
    CallBackURL: `${process.env.CALLBACK_URL}/api/payments/webhooks/mpesa`,
    AccountReference: String(params.accountReference),
    TransactionDesc: "Appointment payment"
  };

  const resp = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return {
    merchantRequestId: resp.data?.MerchantRequestID,
    checkoutRequestId: resp.data?.CheckoutRequestID,
    raw: resp.data
  };
};
```

**`parseCallback`**
Extracts transaction results and metadata from Daraja webhooks.

```typescript
export const parseCallback = (body: any): CallbackParseResult => {
  const stk = body?.Body?.stkCallback || {};
  const success = String(stk.ResultCode) === "0";
  const checkoutRequestId = stk.CheckoutRequestID;
  const items = stk?.CallbackMetadata?.Item || [];

  let amount, phone;
  for (const item of items) {
    if (item?.Name === "Amount") amount = item?.Value;
    if (item?.Name === "PhoneNumber") phone = item?.Value;
  }

  return { valid: !!stk, success, checkoutRequestId, amount, phone, raw: body };
};
```

**`queryStkPushStatus`**
Checks the current status of an STK Push transaction using its `checkoutRequestId`.

```typescript
export const queryStkPushStatus = async (params: StkQueryParams): Promise<StkQueryResponse> => {
  const accessToken = await getAccessToken();
  const base = getBaseUrl();
  const timestamp = buildTimestamp();
  const password = buildPassword(shortCode, passkey, timestamp);

  const resp = await axios.post(`${base}/mpesa/stkpushquery/v1/query`, {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: params.checkoutRequestId
  }, { headers: { Authorization: `Bearer ${accessToken}` } });

  return { ok: true, resultCode: resp.data?.ResultCode, resultDesc: resp.data?.ResultDesc, raw: resp.data };
};
```

---

## Internal Services

The internal payment service (`src/services/internal/paymentService.ts`) orchestrates M-Pesa payments within the application's business logic.

**`initiateMpesaForAppointment`**
Initiates payment for an appointment and links the transaction to the appointment record.

```typescript
export const initiateMpesaForAppointment = async (params: InitiateMpesaParams): Promise<any> => {
  const { appointment, payment, amount, phone } = params;
  const accountReference = appointment._id.toString();

  const res = await initiateStkPush({ amount, phone, accountReference });

  payment.status = "PENDING";
  payment.processorRefs.daraja = {
    merchantRequestId: res.merchantRequestId,
    checkoutRequestId: res.checkoutRequestId
  };
  await payment.save();

  return res;
};
```

**`initiateMpesaForService`**
Handles M-Pesa initiation for service-only payments (no specific appointment).

```typescript
export const initiateMpesaForService = async (params: InitiateMpesaForServiceParams): Promise<any> => {
  const { payment, amount, phone } = params;
  const accountReference = `SRV-${payment._id}-${Date.now()}`;

  const res = await initiateStkPush({ amount, phone, accountReference });

  payment.status = "PENDING";
  payment.processorRefs.daraja = {
    merchantRequestId: res.merchantRequestId,
    checkoutRequestId: res.checkoutRequestId
  };
  await payment.save();

  return res;
};

```

**`applySuccessfulPayment`**
Processes a successful payment, updating the payment status and related appointment details (e.g., remaining amount, status).

```typescript
export const applySuccessfulPayment = async (params: ApplySuccessfulPaymentParams): Promise<any> => {
  const { appointment, payment, io } = params;

  payment.status = "SUCCESS";
  await payment.save();

  if (appointment) {
    if (payment.type === "FULL_PAYMENT") {
      appointment.remainingAmount = 0;
      if (appointment.status === "PENDING") appointment.status = "CONFIRMED";
    }

    if (payment.type === "BOOKING_FEE" && appointment.status === "PENDING") {
      appointment.status = "CONFIRMED";
    }

    await appointment.save();
    if (io) {
      io.emit("payment.updated", { paymentId: payment._id.toString(), status: "SUCCESS" });
      io.emit("appointment.updated", { appointmentId: appointment._id.toString(), status: appointment.status });
    }
  }

  return { payment, appointment };
};
```
```

---

## Usage in Controllers

The payment controller (`src/controllers/paymentController.ts`) handles M-Pesa webhooks and status checks.

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

The Daraja API relies on callbacks (webhooks) to notify the application of transaction outcomes. The `mpesaWebhook` controller function is configured as the `CallBackURL` for STK Push transactions.

All webhook processing is logged with indicators:
- `✅` - Success
- `❌` - Error/Failure
- `🔍` - Database Lookup
- `💳` - Payment Processing

---

## Error Handling

Daraja service functions use `try-catch` blocks with custom error reporting. API failures include HTTP status codes and raw error details when available.

---

## API Examples

**Initiate M-Pesa Payment (Service-Only)**

```bash
curl -X POST http://localhost:4500/api/payments/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "services": ["<serviceId1>"], "method": "MPESA", "phone": "2547XXXXXXXX" }'
```

**Check M-Pesa STK Push Status**

```bash
curl -X GET http://localhost:4500/api/payments/status/<checkoutRequestId> \
  -H "Authorization: Bearer <token>"
```

---

**Last Updated:** April 2026
**Version:** 1.1.0
**Maintainer:** Appointment API Development Team
