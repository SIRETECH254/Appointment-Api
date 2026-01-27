import axios from "axios";

export interface PaystackTransactionParams {
  amount: number;
  email: string;
  reference: string;
  callbackUrl?: string | undefined;
  currency?: string | undefined;
}

export interface PaystackTransactionResponse {
  authorizationUrl: string;
  reference: string;
  raw: any;
}

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
        amount: Math.round(params.amount * 100),
        currency: params.currency || "KES",
        reference: params.reference,
        callback_url: params.callbackUrl
      },
      { headers: { Authorization: `Bearer ${secret}` } }
    );

    return {
      authorizationUrl: resp.data?.data?.authorization_url,
      reference: resp.data?.data?.reference,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = `Paystack transaction initialization failed${status ? ` (HTTP ${status})` : ""}`;
    const details = typeof data === "object" ? JSON.stringify(data) : data || err.message;
    throw new Error(`${message}: ${details}`);
  }
};

export interface PaystackWebhookParseResult {
  valid: boolean;
  success: boolean;
  reference?: string | undefined;
  raw?: any;
}

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

export interface VerifyTransactionParams {
  reference: string;
}

export interface VerifyTransactionResponse {
  success: boolean;
  amount?: number | undefined;
  currency?: string | undefined;
  status?: string | undefined;
  raw?: any;
  error?: string | undefined;
}

export const verifyTransaction = async (
  params: VerifyTransactionParams
): Promise<VerifyTransactionResponse> => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Paystack secret not configured");

  try {
    const resp = await axios.get(`https://api.paystack.co/transaction/verify/${params.reference}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });

    const data = resp.data?.data;
    return {
      success: data?.status === "success",
      amount: data?.amount ? data.amount / 100 : undefined,
      currency: data?.currency,
      status: data?.status,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    return {
      success: false,
      error: `Paystack verification failed${status ? ` (HTTP ${status})` : ""}`,
      raw: data
    };
  }
};
