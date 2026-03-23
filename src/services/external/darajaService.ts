import axios from "axios";

const getBaseUrl = () => {
  const env = (process.env.MPESA_ENV || "sandbox").toLowerCase();
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
};

// Create axios instance with proper headers to bypass Incapsula WAF
const createAxiosInstance = () => {
  return axios.create({
    timeout: 30000, // 30 seconds timeout
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json'
    }
  });
};

// Retry logic with exponential backoff
const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on 4xx errors (except 429 rate limit)
      if (error?.response?.status && 
          error.response.status >= 400 && 
          error.response.status < 500 && 
          error.response.status !== 429) {
        throw error;
      }
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Daraja request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

export const getAccessToken = async (forceRefresh: boolean = false): Promise<string> => {
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || "").trim();
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || "").trim();

  if (!consumerKey || !consumerSecret) {
    throw new Error("Daraja credentials not configured: Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET");
  }

  const base = getBaseUrl();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const axiosInstance = createAxiosInstance();

  try {
    const response = await retryRequest(async () => {
      return await axiosInstance.get(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }
      });
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

export const buildTimestamp = (): string => {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
};

export const buildPassword = (shortCode: string, passkey: string, timestamp: string): string => {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");
};

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

export interface StkPushParams {
  amount: number;
  phone: string;
  accountReference: string;
  callbackUrl?: string;
}

export interface StkPushResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  raw: any;
}

export const initiateStkPush = async (params: StkPushParams): Promise<StkPushResponse> => {
  const shortCode = process.env.MPESA_SHORT_CODE;
  const passkey = process.env.MPESA_PASSKEY;
  const partyB = shortCode;

  if (!shortCode || !passkey) {
    throw new Error("Daraja short code or passkey not configured");
  }

  const accessToken = await getAccessToken();
  const base = getBaseUrl();
  const timestamp = buildTimestamp();
  const password = buildPassword(shortCode, passkey, timestamp);

  // Normalize phone number to 254XXXXXXXXX format
  const normalizedPhone = normalizePhoneNumber(params.phone);

  const callback = (process.env.CALLBACK_URL ? `${process.env.CALLBACK_URL}/api/payments/webhooks/mpesa` : "") ||
                   (process.env.API_BASE_URL ? `${process.env.API_BASE_URL}/api/payments/webhooks/mpesa` : "");

  if (!callback) {
    throw new Error("Daraja callback URL not configured (CALLBACK_URL or API_BASE_URL missing)");
  }

  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(params.amount),
    PartyA: normalizedPhone,
    PartyB: Number(partyB),
    PhoneNumber: normalizedPhone,
    CallBackURL: callback,
    AccountReference: String(params.accountReference),
    TransactionDesc: "Appointment payment"
  };

  const axiosInstance = createAxiosInstance();

  try {
    const resp = await retryRequest(async () => {
      return await axiosInstance.post(`${base}/mpesa/stkpush/v1/processrequest`, payload, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
      });
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

export interface CallbackParseResult {
  valid: boolean;
  success: boolean;
  checkoutRequestId?: string | undefined;
  amount?: number | undefined;
  phone?: string | undefined;
  raw?: any;
  stk?: any;
}

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

  console.log("===== PARSING DARAJA CALLBACK =====");
  console.log("STK Callback:", JSON.stringify(stk, null, 2));
  console.log("CallbackMetadata Items:", JSON.stringify(items, null, 2));
  console.log("Result Code:", resultCode);
  console.log("====================================");

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

export interface StkQueryParams {
  checkoutRequestId: string;
  shortCode?: string | undefined;
  passkey?: string | undefined;
}

export interface StkQueryResponse {
  ok: boolean;
  resultCode?: string | number | undefined;
  resultDesc?: string | undefined;
  raw?: any;
  error?: string | undefined;
  details?: string | undefined;
}

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

  const axiosInstance = createAxiosInstance();

  try {
    const resp = await retryRequest(async () => {
      return await axiosInstance.post(
        `${base}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: Number(resolvedShortCode),
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: params.checkoutRequestId
        },
        { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
      );
    });

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
      error: `Daraja STK Query failed${status ? ` (HTTP ${status})` : ""}`,
      details: typeof data === "object" ? JSON.stringify(data) : data || err.message
    };
  }
};