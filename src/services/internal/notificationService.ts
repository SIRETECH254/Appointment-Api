import { sendOTPEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../external/emailService";
import { sendOTPSMS, sendPasswordResetSMS, sendWelcomeSMS } from "../external/smsService";

export const sendOTPNotification = async (
  email: string,
  phone: string,
  otp: string,
  name: string
): Promise<any> => {
  const results: any = { email: null, sms: null };
  const messageName = name || "User";

  if (email) {
    results.email = await sendOTPEmail(email, otp, messageName);
  }

  if (phone && process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME) {
    results.sms = await sendOTPSMS(phone, otp, messageName);
  } else if (phone) {
    results.sms = { skipped: true, reason: "SMS credentials not configured" };
  }

  return results;
};

export const sendPasswordResetNotification = async (
  email: string,
  phone: string,
  resetToken: string,
  name: string
): Promise<any> => {
  const results: any = { email: null, sms: null };
  const messageName = name || "User";

  if (email) {
    results.email = await sendPasswordResetEmail(email, resetToken, messageName);
  }

  if (phone && process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME) {
    results.sms = await sendPasswordResetSMS(phone, resetToken, messageName);
  } else if (phone) {
    results.sms = { skipped: true, reason: "SMS credentials not configured" };
  }

  return results;
};

export const sendWelcomeNotification = async (
  email: string,
  phone: string,
  name: string
): Promise<any> => {
  const results: any = { email: null, sms: null };
  const messageName = name || "User";

  if (email) {
    results.email = await sendWelcomeEmail(email, messageName);
  }

  if (phone && process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME) {
    results.sms = await sendWelcomeSMS(phone, messageName);
  } else if (phone) {
    results.sms = { skipped: true, reason: "SMS credentials not configured" };
  }

  return results;
};
