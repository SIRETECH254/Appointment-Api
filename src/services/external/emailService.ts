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
    service: "gmail",
    auth: { user: smtpUser, pass: smtpPass }
  });
};

// Send OTP email
export const sendOTPEmail = async (email: string, otp: string, name: string = "User") => {
  if (!email || !otp) {
    throw errorHandler(400, "Email and OTP are required for sending OTP email");
  }

  try {
    const transporter = createTransporter();
    const message = `Hello ${name}, your OTP code is ${otp}. It expires soon.`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: "Your OTP Code",
      text: message
    };

    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error: any, info: any) => {
        if (error) {
          reject(errorHandler(500, `Failed to send OTP email: ${error.message}`));
        } else {
          resolve({ success: true, messageId: info.messageId });
        }
      });
    });
  } catch (error: any) {
    console.error("Error sending OTP email:", error);
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
    const transporter = createTransporter();
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
    const message = `Hello ${name}, reset your password using: ${resetUrl}. This link expires soon.`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: "Password Reset",
      text: message
    };

    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error: any, info: any) => {
        if (error) {
          reject(errorHandler(500, `Failed to send password reset email: ${error.message}`));
        } else {
          resolve({ success: true, messageId: info.messageId });
        }
      });
    });
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    throw errorHandler(500, `Failed to send password reset email: ${error.message}`);
  }
};

// Send welcome email
export const sendWelcomeEmail = async (email: string, name: string) => {
  if (!email || !name) {
    throw errorHandler(400, "Email and name are required for sending welcome email");
  }

  try {
    const transporter = createTransporter();
    const message = `Welcome ${name}! Your account has been verified successfully.`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: "Welcome to Appointment API",
      text: message
    };

    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error: any, info: any) => {
        if (error) {
          reject(errorHandler(500, `Failed to send welcome email: ${error.message}`));
        } else {
          resolve({ success: true, messageId: info.messageId });
        }
      });
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    throw errorHandler(500, `Failed to send welcome email: ${error.message}`);
  }
};
