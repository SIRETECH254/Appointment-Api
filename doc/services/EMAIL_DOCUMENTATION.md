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

The email service is responsible for sending various types of email communications, such as OTP codes, password reset links, welcome messages, and general notifications. It utilizes `nodemailer` to interact with an SMTP server (configured for Gmail by default).

**Key Features:**
-   **OTP Delivery:** Sends one-time password codes for user verification.
-   **Password Reset Links:** Delivers secure links for password recovery.
-   **Welcome Messages:** Greets new users upon successful account verification.
-   **Generic Notifications:** Supports sending custom messages for various events.
-   **Configurable SMTP:** Easily adaptable to different SMTP providers.

---

## Configuration

Email service credentials and settings are managed through environment variables and configured in `src/services/external/emailService.ts`.

**Environment Variables:**
-   `SMTP_HOST`: The SMTP server host (e.g., `smtp.gmail.com`).
-   `SMTP_PORT`: The SMTP server port (default: `587`).
-   `SMTP_USER`: The username for SMTP authentication (e.g., your Gmail address).
-   `SMTP_PASSWORD` or `SMTP_PASS`: The password for SMTP authentication (e.g., your Gmail App Password).
-   `FROM_EMAIL`: The email address to use as the sender (default: `noreply@appointmentapp.com`).
-   `FRONTEND_URL`: Used to construct password reset links (e.g., `http://localhost:3000`).

**File: `src/services/external/emailService.ts` - Initialization Snippet**
```typescript
import nodemailer from "nodemailer";
import { errorHandler } from "../../middleware/errorHandler";

const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "";
const smtpHost = process.env.SMTP_HOST || "";
const fromEmail = process.env.FROM_EMAIL || smtpUser || "noreply@appointmentapp.com";

// Create email transporter
const createTransporter = () => {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw errorHandler(500, "Email configuration is missing. Please check SMTP environment variables.");
  }

  return nodemailer.createTransport({
    service: "gmail", // Configured for Gmail, but can be changed
    auth: { user: smtpUser, pass: smtpPass }
  });
};
```

---

## Key Functions/Service Methods

The `src/services/external/emailService.ts` file provides the following functions for sending emails.

**`createTransporter`**
A helper function that creates and returns a `nodemailer` transporter instance, configured with SMTP credentials. It throws an error if email configuration environment variables are missing.
```typescript
const createTransporter = () => {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw errorHandler(500, "Email configuration is missing. Please check SMTP environment variables.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: smtpUser, pass: smtpPass }
  });
};
```

**`sendOTPEmail`**
Sends an email containing a One-Time Password to a user.
```typescript
export const sendOTPEmail = async (email: string, otp: string, name: string = "User") => {
  if (!email || !otp) {
    throw errorHandler(400, "Email and OTP are required for sending OTP email");
  }

  try {
    const transporter = createTransporter();
    const message = `Hello \${name}, your OTP code is \${otp}. It expires soon.`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: "Your OTP Code",
      text: message
    };

    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error: any, info: any) => {
        if (error) {
          reject(errorHandler(500, `Failed to send OTP email: \${error.message}`));
        } else {
          resolve({ success: true, messageId: info.messageId });
        }
      });
    });
  } catch (error: any) {
    console.error("Error sending OTP email:", error);
    throw errorHandler(500, `Failed to send OTP email: \${error.message}`);
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
    const transporter = createTransporter();
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password/\${resetToken}`;
    const message = `Hello \${name}, reset your password using: \${resetUrl}. This link expires soon.`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: "Password Reset",
      text: message
    };

    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error: any, info: any) => {
        if (error) {
          reject(errorHandler(500, `Failed to send password reset email: \${error.message}`));
        } else {
          resolve({ success: true, messageId: info.messageId });
        }
      });
    });
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    throw errorHandler(500, `Failed to send password reset email: \${error.message}`);
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
    const transporter = createTransporter();
    const message = `Welcome \${name}! Your account has been verified successfully.`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: "Welcome to Appointment API",
      text: message
    };

    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error: any, info: any) => {
        if (error) {
          reject(errorHandler(500, `Failed to send welcome email: \${error.message}`));
        } else {
          resolve({ success: true, messageId: info.messageId });
        }
      });
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    throw errorHandler(500, `Failed to send welcome email: \${error.message}`);
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
    const transporter = createTransporter();

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject,
      text: message
    };

    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error: any, info: any) => {
        if (error) {
          reject(errorHandler(500, `Failed to send email: \${error.message}`));
        } else {
          resolve({ success: true, messageId: info.messageId });
        }
      });
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    throw errorHandler(500, `Failed to send email: \${error.message}`);
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
      await sendGenericEmail(recipientEmail, `Re: \${contact.subject}`, trimmedMessage);
```

---

## Error Handling

All email service functions are designed with `try-catch` blocks to manage potential errors during email transmission, such as invalid configurations, SMTP server issues, or network problems. Errors are standardized using the `errorHandler` middleware. A check for missing SMTP environment variables is performed during transporter creation.

---

## API Examples

**Send Bulk Notification via Email (Admin only)**

```bash
curl -X POST http://localhost:4500/api/notifications/bulk 
  -H "Authorization: Bearer <admin_token>" 
  -H "Content-Type: application/json" 
  -d '{
    "recipients": ["<user_id_1>", "<user_id_2>"],
    "type": "email",
    "category": "general",
    "subject": "System Announcement",
    "message": "Dear user, the system will undergo maintenance tonight."
  }'
```

**Reply to a Contact Submission (Admin only)**

```bash
curl -X POST http://localhost:4500/api/contact/<contactId>/reply 
  -H "Authorization: Bearer <admin_token>" 
  -H "Content-Type: application/json" 
  -d '{"message": "Thank you for your message. We have received it and will respond shortly."}'
```

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** Appointment API Development Team
