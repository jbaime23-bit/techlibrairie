// src/lib/cinetpay.ts
// Paiement par Mobile Money avec CinetPay (API Checkout v2).
// Le statut d'un paiement est TOUJOURS revérifié auprès de CinetPay.

const CINETPAY_BASE_URL = "https://api-checkout.cinetpay.com/v2";
const REQUEST_TIMEOUT_MS = 20_000;

function getCredentials(): { apikey: string; siteId: string } {
  const apikey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;

  if (!apikey || !siteId) {
    throw new Error("CINETPAY_API_KEY et CINETPAY_SITE_ID sont obligatoires.");
  }
  return { apikey, siteId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface CinetPayInitParams {
  transactionId: string;
  amount: number;
  description: string;
  orderId: string;
  appUrl: string;
}

export interface CinetPayInitResult {
  paymentUrl: string;
  paymentToken: string;
}

/**
 * Initialise un paiement Mobile Money (XOF) et renvoie l'URL du guichet CinetPay.
 * Le montant doit être un multiple de 5.
 */
export async function initCinetPayPayment(
  params: CinetPayInitParams
): Promise<CinetPayInitResult> {
  const { apikey, siteId } = getCredentials();

  const response = await fetch(`${CINETPAY_BASE_URL}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey,
      site_id: siteId,
      transaction_id: params.transactionId,
      amount: params.amount,
      currency: "XOF",
      description: params.description,
      notify_url: `${params.appUrl}/api/webhooks/cinetpay`,
      return_url: `${params.appUrl}/api/paiement/retour?commande=${params.orderId}`,
      channels: "MOBILE_MONEY",
      lang: "fr",
      metadata: params.orderId,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body: unknown = await response.json().catch(() => null);
  const root = isRecord(body) ? body : {};
  const data = isRecord(root.data) ? root.data : {};

  if (
    String(root.code) !== "201" ||
    typeof data.payment_url !== "string" ||
    typeof data.payment_token !== "string"
  ) {
    const reason =
      typeof root.description === "string"
        ? root.description
        : typeof root.message === "string"
          ? root.message
          : "réponse inattendue";
    throw new Error(`CinetPay a refusé l'initialisation : ${reason}`);
  }

  // Protection : on ne redirige le client que vers un domaine CinetPay.
  const hostname = new URL(data.payment_url).hostname;
  if (!hostname.endsWith("cinetpay.com")) {
    throw new Error("URL de paiement CinetPay inattendue.");
  }

  return { paymentUrl: data.payment_url, paymentToken: data.payment_token };
}

export type CinetPayStatus = "ACCEPTED" | "REFUSED" | "PENDING";

export interface CinetPayCheckResult {
  status: CinetPayStatus;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  operatorId: string | null;
}

/** Interroge CinetPay pour obtenir le statut réel d'une transaction. */
export async function checkCinetPayPayment(
  transactionId: string
): Promise<CinetPayCheckResult> {
  const { apikey, siteId } = getCredentials();

  const response = await fetch(`${CINETPAY_BASE_URL}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey,
      site_id: siteId,
      transaction_id: transactionId,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!isRecord(body)) {
    throw new Error(
      `Réponse invalide de CinetPay lors de la vérification (HTTP ${response.status}).`
    );
  }

  const data = isRecord(body.data) ? body.data : {};
  const rawStatus =
    typeof data.status === "string" ? data.status.toUpperCase() : "";

  let status: CinetPayStatus = "PENDING";
  if (String(body.code) === "00" && rawStatus === "ACCEPTED") {
    status = "ACCEPTED";
  } else if (rawStatus === "REFUSED") {
    status = "REFUSED";
  }

  return {
    status,
    amount: Number(data.amount),
    currency: typeof data.currency === "string" ? data.currency : "",
    paymentMethod:
      typeof data.payment_method === "string" ? data.payment_method : null,
    operatorId: typeof data.operator_id === "string" ? data.operator_id : null,
  };
      }
