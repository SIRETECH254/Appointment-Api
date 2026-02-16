# 📱 Appointment API - SMS Service Documentation

## 📋 Table of Contents
- [SMS Service Overview](#sms-service-overview)
- [Configuration](#configuration)
- [Key Functions/Service Methods](#key-functionsservice-methods)
- [Usage in Internal Services](#usage-in-internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)

---

## SMS Service Overview

The SMS service in this project utilizes Africa's Talking API to send various types of text messages, such as OTP codes, password reset links, welcome messages, and generic notifications. It provides a robust and reliable way to communicate with users via SMS.

**Key Features:**
-   **OTP Delivery:** Sends one-time password codes for user verification.
-   **Password Reset Links:** Delivers secure links for password recovery.
-   **Welcome Messages:** Greets new users upon successful account verification.
-   **Generic Notifications:** Supports sending custom messages for various events.
-   **Phone Number Formatting:** Standardizes Kenyan phone numbers for API compatibility.

---

## Configuration

Africa's Talking API credentials are managed through environment variables and initialized in `src/services/external/smsService.ts`. The service is only initialized if valid credentials are provided.

**Environment Variables:**
-   `AFRICAS_TALKING_API_KEY`: Your Africa's Talking API Key.
-   `AFRICAS_TALKING_USERNAME`: Your Africa's Talking Username.
-   `SMS_SENDER_ID` (Optional): A custom sender ID (alphanumeric string) for outgoing SMS.

**File: `src/services/external/smsService.ts` - Initialization Snippet**
```typescript
import AfricasTalking from "africastalking";
import { errorHandler } from "../../middleware/errorHandler";

let africasTalking: any = null;
let sms: any = null;

if (
  process.env.AFRICAS_TALKING_API_KEY &&
  process.env.AFRICAS_TALKING_USERNAME &&
  process.env.AFRICAS_TALKING_API_KEY !== "your-africastalking-api-key" &&
  process.env.AFRICAS_TALKING_USERNAME !== "your-africastalking-username"
) {
  africasTalking = new AfricasTalking({
    apiKey: process.env.AFRICAS_TALKING_API_KEY,
    username: process.env.AFRICAS_TALKING_USERNAME
  });

  sms = africasTalking.SMS;
} else {
  console.warn("Africa's Talking SMS service not initialized: Invalid or missing credentials");
}
```

---

## Key Functions/Service Methods

The `src/services/external/smsService.ts` file provides the following functions for sending SMS.

**`formatPhoneNumber`**
A helper function to ensure phone numbers are in the correct international format (e.g., `+2547XXXXXXXX`).
```typescript
const formatPhoneNumber = (phone: string): string => {
  let cleanNumber = phone.replace(/[\s\-\+]/g, "");

  if (cleanNumber.startsWith("0")) {
    cleanNumber = "254" + cleanNumber.substring(1);
  }

  if (!cleanNumber.startsWith("254")) {
    cleanNumber = "254" + cleanNumber;
  }

  return "+" + cleanNumber;
};
```

**`sendOTPSMS`**
Sends an SMS containing a One-Time Password to a user.
```typescript
export const sendOTPSMS = async (phone: string, otp: string, name: string = "User") => {
  if (!phone || !otp) {
    throw errorHandler(400, "Phone number and OTP are required for sending SMS");
  }

  if (!sms) {
    throw errorHandler(500, "SMS service not initialized - check Africa's Talking credentials");
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const message = `Hello \${name}, your OTP code is \${otp}. It expires soon.`;

    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    return {
      success: false,
      error: result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status"
    };
  } catch (error: any) {
    console.error("Error sending OTP SMS:", error);
    throw errorHandler(500, `Failed to send OTP SMS: \${error.message}`);
  }
};
```

**`sendPasswordResetSMS`**
Sends an SMS with a password reset link to a user.
```typescript
export const sendPasswordResetSMS = async (
  phone: string,
  resetToken: string,
  name: string = "User"
) => {
  try {
    const formattedPhone = formatPhoneNumber(phone);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password/\${resetToken}`;
    const message = `Hello \${name}, reset your password using: \${resetUrl}. This link expires soon.`;

    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    return {
      success: false,
      error: result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status"
    };
  } catch (error: any) {
    console.error("Error sending password reset SMS:", error);
    return { success: false, error: error.message };
  }
};
```

**`sendWelcomeSMS`**
Sends a welcome SMS to a newly verified user.
```typescript
export const sendWelcomeSMS = async (phone: string, name: string) => {
  try {
    const formattedPhone = formatPhoneNumber(phone);
    const message = `Welcome \${name}! Your account has been verified successfully.`;

    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    return {
      success: false,
      error: result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status"
    };
  } catch (error: any) {
    console.error("Error sending welcome SMS:", error);
    return { success: false, error: error.message };
  }
};
```

**`sendGenericSMS`**
Sends a generic SMS message to a specified phone number.
```typescript
export const sendGenericSMS = async (phone: string, message: string) => {
  if (!phone || !message) {
    throw errorHandler(400, "Phone number and message are required for sending SMS");
  }

  if (!sms) {
    throw errorHandler(500, "SMS service not initialized - check Africa's Talking credentials");
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const options: any = {
      to: [formattedPhone],
      message
    };

    if (process.env.SMS_SENDER_ID) {
      options.from = process.env.SMS_SENDER_ID;
    }

    const result = await sms.send(options);

    if (result?.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      return {
        success: true,
        messageId: result.SMSMessageData.Recipients[0].messageId,
        cost: result.SMSMessageData.Recipients[0].cost
      };
    }

    return {
      success: false,
      error: result?.SMSMessageData?.Recipients?.[0]?.status || "Unknown SMS status"
    };
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    throw errorHandler(500, `Failed to send SMS: \${error.message}`);
  }
};
```

---

## Usage in Internal Services

The internal notification service (`src/services/internal/notificationService.ts`) uses SMS functions for various user-related communications.

**File: `src/services/internal/notificationService.ts` - Snippets**

```typescript
import { sendOTPSMS, sendPasswordResetSMS, sendWelcomeSMS } from "../external/smsService";

// ... inside sendOTPNotification
results.sms = await sendOTPSMS(phone, otp, messageName);

// ... inside sendPasswordResetNotification
results.sms = await sendPasswordResetSMS(phone, resetToken, messageName);

// ... inside sendWelcomeNotification
results.sms = await sendWelcomeSMS(phone, messageName);
```

---

## Usage in Controllers

The notification controller (`src/controllers/notificationController.ts`) uses the generic SMS sending function for bulk and individual notifications.

**File: `src/controllers/notificationController.ts` - Snippets**

```typescript
import { sendGenericSMS } from "../services/external/smsService";

// ... inside sendNotification function
      } else if (type === "sms") {
        if (!recipientUser.phone) {
          throw errorHandler(400, "Recipient phone is missing");
        }
        await sendGenericSMS(recipientUser.phone, message);

// ... inside sendBulkNotification function
        } else if (type === "sms") {
          if (!recipientUser.phone) {
            throw errorHandler(400, "Recipient phone is missing");
          }
          await sendGenericSMS(recipientUser.phone, message);
```

---

## Error Handling

All SMS service functions are equipped with `try-catch` blocks to gracefully handle potential errors during SMS sending, such as network issues, invalid phone numbers, or Africa's Talking API errors. Custom error messages are generated, and the `errorHandler` middleware is utilized for consistent error responses. The service also checks for initialization, throwing an error if Africa's Talking credentials are missing.

---

## API Examples

**Send Bulk Notification via SMS (Admin only)**

```bash
curl -X POST http://localhost:4500/api/notifications/bulk 
  -H "Authorization: Bearer <admin_token>" 
  -H "Content-Type: application/json" 
  -d '{
    "recipients": ["<user_id_1>", "<user_id_2>"],
    "type": "sms",
    "category": "general",
    "subject": "Important Update",
    "message": "Dear customer, we have an important update for you."
  }'
```

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** Appointment API Development Team
