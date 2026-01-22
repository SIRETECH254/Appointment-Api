import nodemailer from "nodemailer";
import africastalking from "africastalking";

const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "";
const smtpHost = process.env.SMTP_HOST || "";
const fromEmail = process.env.FROM_EMAIL || smtpUser || "noreply@appointmentapp.com";

const transporter = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
    })
  : null;

const smsClient =
  process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME
    ? africastalking({
        apiKey: process.env.AFRICAS_TALKING_API_KEY,
        username: process.env.AFRICAS_TALKING_USERNAME
      }).SMS
    : null;

// Send email through configured SMTP transport
const sendEmail = async (to: string, subject: string, text: string): Promise<any> => {
  if (!transporter) {
    throw new Error("SMTP transporter not configured");
  }

  return transporter.sendMail({
    from: fromEmail,
    to,
    subject,
    text
  });
};

// Send SMS via Africa's Talking
const sendSms = async (to: string, message: string): Promise<any> => {
  if (!smsClient) {
    throw new Error("Africa's Talking SMS client not configured");
  }

  return smsClient.send({
    to: [to],
    message
  });
};

// Send OTP via email and SMS
export const sendOTPNotification = async (
  email: string,
  phone: string,
  otp: string,
  name: string
): Promise<any> => {
  const results: any = { email: null, sms: null };
  const message = `Hello ${name}, your OTP code is ${otp}. It expires soon.`;

  if (email) {
    results.email = await sendEmail(email, "Your OTP Code", message);
  }

  if (phone) {
    results.sms = await sendSms(phone, message);
  }

  return results;
};

// Send password reset link via email and SMS
export const sendPasswordResetNotification = async (
  email: string,
  phone: string,
  resetToken: string,
  name: string
): Promise<any> => {
  const results: any = { email: null, sms: null };
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
  const message = `Hello ${name}, reset your password using: ${resetUrl}. This link expires soon.`;

  if (email) {
    results.email = await sendEmail(email, "Password Reset", message);
  }

  if (phone) {
    results.sms = await sendSms(phone, message);
  }

  return results;
};

// Send welcome notification after verification
export const sendWelcomeNotification = async (
  email: string,
  phone: string,
  name: string
): Promise<any> => {
  const results: any = { email: null, sms: null };
  const message = `Welcome ${name}! Your account has been verified successfully.`;

  if (email) {
    results.email = await sendEmail(email, "Welcome to Appointment API", message);
  }

  if (phone) {
    results.sms = await sendSms(phone, message);
  }

  return results;
};
