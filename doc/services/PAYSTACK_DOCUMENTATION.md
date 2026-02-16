# 💳 Appointment API - Paystack Documentation

## 📋 Table of Contents
- [Paystack Overview](#paystack-overview)
- [Configuration](#configuration)
- [Key Functions/Service Methods](#key-functionsservice-methods)
- [Usage in Internal Services](#usage-in-internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Callbacks and Webhooks](#callbacks-and-webhooks)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)

---

## Paystack Overview

Paystack is an online payment gateway that processes payments for businesses. In this project, Paystack is integrated to handle card payments, providing a secure and reliable way for users to pay for services and appointments.

**Key Features:**
-   **Transaction Initialization:** Create and initialize payment transactions.
-   **Webhook Processing:** Receive real-time notifications for payment status updates.
-   **Transaction Verification:** Confirm the status and details of a completed transaction.

---

## Configuration

Paystack API credentials and settings are managed through environment variables and primarily used in `src/services/external/paystackService.ts`.

**Environment Variables:**
-   `PAYSTACK_SECRET_KEY`: Your Paystack Secret Key, used for authenticating API requests and verifying webhooks.
-   `PAYSTACK_CURRENCY`: The default currency for Paystack transactions (e.g., `KES`, `NGN`).

**File: `src/services/external/paystackService.ts` - Configuration Snippet**
```typescript
const secret = process.env.PAYSTACK_SECRET_KEY;
if (!secret) throw new Error("Paystack secret not configured");
```
*(Note: Initialization relies on the `PAYSTACK_SECRET_KEY` being available in the environment.)*

---

## Key Functions/Service Methods

The `src/services/external/paystackService.ts` file provides the core functions for interacting with the Paystack API.

**`initTransaction`**
Initializes a new payment transaction with Paystack, returning an authorization URL where the user can complete the payment.
```typescript
export const initTransaction = async (
  params: PaystackTransactionParams
): Promise<PaystackTransactionResponse> => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Paystack secret not configured");

  try {
    const resp = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: params.email,
        amount: Math.round(params.amount * 100), // Paystack expects amount in kobo/cents
        currency: params.currency || "KES",
        reference: params.reference,
        callback_url: params.callbackUrl
      },
      { headers: { Authorization: `Bearer \${secret}` } }
    );

    return {
      authorizationUrl: resp.data?.data?.authorization_url,
      reference: resp.data?.data?.reference,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = `Paystack transaction initialization failed\${status ? ` (HTTP \${status})` : ""}`;
    const details = typeof data === "object" ? JSON.stringify(data) : data || err.message;
    throw new Error(`\${message}: \${details}`);
  }
};
```

**`parseWebhook`**
Parses the incoming Paystack webhook payload to extract relevant transaction details and status.
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

**`verifyTransaction`**
Verifies the status and details of a Paystack transaction using its reference. This is crucial for confirming webhook notifications securely.
```typescript
export const verifyTransaction = async (
  params: VerifyTransactionParams
): Promise<VerifyTransactionResponse> => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Paystack secret not configured");

  try {
    const resp = await axios.get(`https://api.paystack.co/transaction/verify/\${params.reference}`, {
      headers: { Authorization: `Bearer \${secret}` }
    });

    const data = resp.data?.data;
    return {
      success: data?.status === "success",
      amount: data?.amount ? data.amount / 100 : undefined, // Convert kobo/cents back to main currency unit
      currency: data?.currency,
      status: data?.status,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    return {
      success: false,
      error: `Paystack verification failed\${status ? ` (HTTP \${status})` : ""}`,
      raw: data
    };
  }
};
```

---

## Usage in Internal Services

The internal payment service (`src/services/internal/paymentService.ts`) utilizes Paystack functions to initiate card transactions for both service-only payments and appointment payments.

**File: `src/services/internal/paymentService.ts` - Snippets**

```typescript
import { initTransaction } from "../external/paystackService";

// ... inside initiatePaystackForAppointment function
const res = await initTransaction({
  amount,
  email,
  reference,
  callbackUrl: callbackUrl || undefined,
  currency: process.env.PAYSTACK_CURRENCY || "KES"
});

// ... inside initiatePaystackForService function
const res = await initTransaction({
  amount,
  email,
  reference,
  callbackUrl: callbackUrl || undefined,
  currency: process.env.PAYSTACK_CURRENCY || "KES"
});
```

---

## Usage in Controllers

The payment controller (`src/controllers/paymentController.ts`) handles incoming Paystack webhooks and verifies transactions.

**File: `src/controllers/paymentController.ts` - Snippets**

```typescript
import { parseWebhook, verifyTransaction } from "../services/external/paystackService";

// ... inside paystackWebhook function
const parsed = parseWebhook(req.body);
// ...
const verification = await verifyTransaction({ reference: parsed.reference });
```

---

## Callbacks and Webhooks

The Paystack API communicates transaction updates via webhooks. The `paystackWebhook` controller function (`src/controllers/paymentController.ts`) is configured to receive these notifications. It's crucial to verify the authenticity of Paystack webhooks using the `verifyTransaction` function.

**File: `src/controllers/paymentController.ts` - `paystackWebhook` function**
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

---

## Error Handling

Paystack service functions include robust error handling with `try-catch` blocks to manage API communication failures, invalid responses, or configuration issues. Errors are standardized using the `errorHandler` middleware.

---

## API Examples

**Initiate Card Payment (Service-Only)**

```bash
curl -X POST http://localhost:4500/api/payments/initiate 
  -H "Authorization: Bearer <token>" 
  -H "Content-Type: application/json" 
  -d '{
    "services": ["<serviceId1>", "<serviceId2>"],
    "method": "CARD",
    "email": "customer@example.com"
  }'
```

**Initiate Card Payment (For Remaining Appointment Amount)**

```bash
curl -X POST http://localhost:4500/api/payments/service-payment 
  -H "Authorization: Bearer <token>" 
  -H "Content-Type: application/json" 
  -d '{
    "appointmentId": "<appointmentId>",
    "method": "CARD",
    "email": "customer@example.com"
  }'
```

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** Appointment API Development Team
