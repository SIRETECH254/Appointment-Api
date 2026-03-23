import sgMail from "@sendgrid/mail";
import { errorHandler } from "../../middleware/errorHandler";

// SendGrid requires a verified sender. We'll use SMTP_USER or FROM_EMAIL if available.
const fromEmail = process.env.SMTP_FROM || "";

// Initialize SendGrid with API Key
const initializeSendGrid = () => {

    if (!process.env.SMTP_PASS) {
        throw errorHandler(500, "SendGrid API Key is missing. Please check the SMTP_PASS environment variable.")
    }

    sgMail.setApiKey(process.env.SMTP_PASS)

}

// Send OTP email
export const sendOTPEmail = async (email: string, otp: string, name: string = "User") => {
  if (!email || !otp) {
    throw errorHandler(400, "Email and OTP are required for sending OTP email");
  }

  try {
    initializeSendGrid();
    const message = `Hello ${name}, your OTP code is ${otp}. It expires soon.`;

    const msg = {
      to: email,
      from: `APPOINTMENT <${fromEmail}>`,
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

// Send password reset email
export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  name: string = "User"
) => {
  if (!email || !resetToken) {
    throw errorHandler(400, "Email and reset token are required for sending password reset email");
  }

  try {
    initializeSendGrid();
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
    if (error.response) {
      console.error(error.response.body);
    }
    throw errorHandler(500, `Failed to send password reset email: ${error.message}`);
  }
};

// Send welcome email
export const sendWelcomeEmail = async (email: string, name: string) => {
  if (!email || !name) {
    throw errorHandler(400, "Email and name are required for sending welcome email");
  }

  try {
    initializeSendGrid();
    const message = `Welcome ${name}! Your account has been verified successfully.`;

    const msg = {
      to: email,
      from: `APPOINTMENT <${fromEmail}>`,
      subject: "Welcome to Appointment API",
      text: message,
      html: `<strong>${message}</strong>`,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw errorHandler(500, `Failed to send welcome email: ${error.message}`);
  }
};

export const sendGenericEmail = async (email: string, subject: string, message: string) => {
  if (!email || !subject || !message) {
    throw errorHandler(400, "Email, subject, and message are required for sending email");
  }

  try {
    initializeSendGrid();
    const msg = {
      to: email,
      from: `APPOINTMENT <${fromEmail}>`,
      subject,
      text: message,
      html: `<p>${message}</p>`,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending email:", error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw errorHandler(500, `Failed to send email: ${error.message}`);
  }
};