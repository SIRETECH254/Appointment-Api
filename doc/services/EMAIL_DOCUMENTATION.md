# 📧 Appointment API - Email Service Documentation

## 📋 Table of Contents
- [Email Service Overview](#email-service-overview)
- [Configuration](#configuration)
- [Key Functions/Service Methods](#key-functionsservice-methods)
- [Usage in Internal Services](#usage-in-internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)

---

## Email Service Overview

The email service is responsible for sending various types of email communications, such as OTP codes, password reset links, welcome messages, and general notifications. It utilizes `SendGrid` (`@sendgrid/mail`) to deliver emails.

**Key Features:**
-   **OTP Delivery:** Sends one-time password codes for user verification.
-   **Password Reset Links:** Delivers secure links for password recovery.
-   **Welcome Messages:** Greets new users upon successful account verification.
-   **Generic Notifications:** Supports sending custom messages for various events.
-   **HTML Support:** Emails are sent with both text and HTML content for better formatting.

---

## Configuration

Email service credentials and settings are managed through environment variables and configured in `src/services/external/emailService.ts`.

**Environment Variables:**
-   `SMTP_PASS`: The SendGrid API Key. (Required)
-   `SMTP_USER`: The sender email address (or user for some configurations). If `FROM_EMAIL` is not set, this is used. (Required for sender address if FROM_EMAIL is missing)
-   `FROM_EMAIL`: The verified sender email address. (Default: `noreply@appointmentapp.com`)
-   `FRONTEND_URL`: Used to construct password reset links (e.g., `http://localhost:3000`).

**File: `src/services/external/emailService.ts` - Initialization Snippet**
```typescript
import sgMail from "@sendgrid/mail";
import { errorHandler } from "../../middleware/errorHandler";

const smtpPass = process.env.SMTP_PASS || "";
// SendGrid requires a verified sender. We'll use SMTP_USER or FROM_EMAIL if available.
const fromEmail = process.env.SMTP_USER || process.env.FROM_EMAIL || "noreply@appointmentapp.com";

if (!smtpPass) {
  console.warn("SendGrid API Key (SMTP_PASS) is missing. Email sending will fail.");
} else {
  sgMail.setApiKey(smtpPass);
}
```

---

## Key Functions/Service Methods

The `src/services/external/emailService.ts` file provides the following functions for sending emails.

**`sendOTPEmail`**
Sends an email containing a One-Time Password to a user.
```typescript
export const sendOTPEmail = async (email: string, otp: string, name: string = "User") => {
  if (!email || !otp) {
    throw errorHandler(400, "Email and OTP are required for sending OTP email");
  }

  try {
    const message = `Hello ${name}, your OTP code is ${otp}. It expires soon.`;

    const msg = {
      to: email,
      from: `"APPOINTMENT" <${fromEmail}>`,
      subject: "Your OTP Code",
      text: message,
      html: `<strong>${message}</strong>`, // SendGrid supports HTML
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending OTP email:", error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw errorHandler(500, `Failed to send OTP email: ${error.message}`);
  }
};
```

**`sendPasswordResetEmail`**
Sends an email with a password reset link to a user.
```typescript
export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  name: string = "User"
) => {
  if (!email || !resetToken) {
    throw errorHandler(400, "Email and reset token are required for sending password reset email");
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
    const message = `Hello ${name}, reset your password using: ${resetUrl}. This link expires soon.`;

    const msg = {
      to: email,
      from: `"APPOINTMENT" <${fromEmail}>`,
      subject: "Password Reset",
      text: message,
      html: `<p>Hello ${name},</p><p>Reset your password using: <a href="${resetUrl}">${resetUrl}</a></p><p>This link expires soon.</p>`,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    throw errorHandler(500, `Failed to send password reset email: ${error.message}`);
  }
};
```

**`sendWelcomeEmail`**
Sends a welcome email to a newly verified user.
```typescript
export const sendWelcomeEmail = async (email: string, name: string) => {
  if (!email || !name) {
    throw errorHandler(400, "Email and name are required for sending welcome email");
  }

  try {
    const message = `Welcome ${name}! Your account has been verified successfully.`;

    const msg = {
      to: email,
      from: `"APPOINTMENT" <${fromEmail}>`,
      subject: "Welcome to Appointment API",
      text: message,
      html: `<strong>${message}</strong>`,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    throw errorHandler(500, `Failed to send welcome email: ${error.message}`);
  }
};
```

**`sendGenericEmail`**
Sends a generic email message with a specified subject and content to a recipient.
```typescript
export const sendGenericEmail = async (email: string, subject: string, message: string) => {
  if (!email || !subject || !message) {
    throw errorHandler(400, "Email, subject, and message are required for sending email");
  }

  try {
    const msg = {
      to: email,
      from: `"APPOINTMENT" <${fromEmail}>`,
      subject,
      text: message,
      html: `<p>${message}</p>`,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending email:", error);
    throw errorHandler(500, `Failed to send email: ${error.message}`);
  }
};
```

---

## Usage in Internal Services

The internal notification service (`src/services/internal/notificationService.ts`) uses email functions for various user-related communications.

**File: `src/services/internal/notificationService.ts` - Snippets**

```typescript
import { sendOTPEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../external/emailService";

// ... inside sendOTPNotification
results.email = await sendOTPEmail(email, otp, messageName);

// ... inside sendPasswordResetNotification
results.email = await sendPasswordResetEmail(email, resetToken, messageName);

// ... inside sendWelcomeNotification
results.email = await sendWelcomeEmail(email, messageName);
```

---

## Usage in Controllers

The `notificationController.ts` and `contactController.ts` utilize the generic email sending function for sending notifications and replies respectively.

**File: `src/controllers/notificationController.ts` - Snippets**

```typescript
import { sendGenericEmail } from "../services/external/emailService";

// ... inside sendNotification function
      if (type === "email") {
        if (!recipientUser.email) {
          throw errorHandler(400, "Recipient email is missing");
        }
        await sendGenericEmail(recipientUser.email, subject, message);

// ... inside sendBulkNotification function
        if (type === "email") {
          if (!recipientUser.email) {
            throw errorHandler(400, "Recipient email is missing");
          }
          await sendGenericEmail(recipientUser.email, subject, message);
```

**File: `src/controllers/contactController.ts` - Snippets**

```typescript
import { sendGenericEmail } from "../services/external/emailService";

// ... inside replyToContact function
      await sendGenericEmail(recipientEmail, `Re: ${contact.subject}`, trimmedMessage);
```

---

## Error Handling

All email service functions are designed with `try-catch` blocks to manage potential errors during email transmission. Errors are standardized using the `errorHandler` middleware.

---

**Last Updated:** March 2026
**Version:** 1.0.1
**Maintainer:** Appointment API Development Team
