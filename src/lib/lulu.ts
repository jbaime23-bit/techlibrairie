// src/lib/lulu.ts
// Client de l'API Lulu Print (impression à la demande). Fichier autonome, non branché sur le site :
// il ne s'exécute que lorsqu'une de ses fonctions est appelée.
//
// Variables Vercel :
//   LULU_CLIENT_KEY, LULU_CLIENT_SECRET  clés de l'API (portail développeurs de Lulu)
//   LULU_ENV                             "production" pour le mode réel ; tout autre valeur = bac à sable
//   LULU_CONTACT_EMAIL                   adresse de contact du commerçant (pas celle de l'acheteur)
//   LULU_AUTO_ENABLED                    "true" pour autoriser l'envoi automatique (absent = coupé)
//
// À vérifier dans le bac à sable avant la mise en service : les noms de champs des fonctions
// calculateCost et getShippingOptions, ainsi que le champ du niveau d'expédition (shipping_level).

export type LuluShippingLevel = "MAIL" | "PRIORITY_MAIL" | "GROUND" | "EXPEDITED" | "EXPRESS";

const SHIPPING_LEVELS: readonly LuluShippingLevel[] = [
  "MAIL",
  "PRIORITY_MAIL",
  "GROUND",
  "EXPEDITED",
  "EXPRESS",
];

export function isLuluShippingLevel(value: string): value is LuluShippingLevel {
  return SHIPPING_LEVELS.some((level) => level === value);
}

export interface LuluConfig {
  environment: "sandbox" | "production";
  baseUrl: string;
  clientKey: string;
  clientSecret: string;
  contactEmail: string | null;
}

const BASE_URLS = {
  sandbox: "https://api.sandbox.lulu.com",
  production: "https://api.lulu.com",
} as const;

const TOKEN_PATH = "/auth/realms/glasstree/protocol/openid-connect/token";

export class LuluApiError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, status: number | null, retryable: boolean) {
    super(message);
    this.name = "LuluApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

/** Configuration Lulu, ou null si les clés sont absentes. */
export function getLuluConfig(): LuluConfig | null {
  const clientKey = process.env.LULU_CLIENT_KEY?.trim();
  const clientSecret = process.env.LULU_CLIENT_SECRET?.trim();

  if (!clientKey || !clientSecret) return null;

  const environment = process.env.LULU_ENV?.trim() === "production" ? "production" : "sandbox";
  const contactEmail = process.env.LULU_CONTACT_EMAIL?.trim() || null;

  return {
    environment,
    baseUrl: BASE_URLS[environment],
    clientKey,
    clientSecret,
    contactEmail,
  };
}

/** Vrai seulement si les clés existent ET si l'interrupteur LULU_AUTO_ENABLED vaut "true". */
export function isLuluAutoEnabled(): boolean {
  return getLuluConfig() !== null && process.env.LULU_AUTO_ENABLED?.trim() === "true";
}

function requireConfig(): LuluConfig {
  const config = getLuluConfig();

  if (!config) {
    throw new LuluApiError(
      "Lulu n'est pas configuré : LULU_CLIENT_KEY et LULU_CLIENT_SECRET sont absentes.",
      null,
      false
    );
  }

  return config;
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : "erreur inconnue";
  return message.replace(/\s+/g, " ").slice(0, 160);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

// ---------------------------------------------------------------------------
// Authentification (OAuth 2.0, flux « client credentials »)
// ---------------------------------------------------------------------------

interface CachedToken {
  value: string;
  expiresAt: number;
  baseUrl: string;
}

let cachedToken: CachedToken | null = null;

async function fetchAccessToken(config: LuluConfig): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.baseUrl === config.baseUrl && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${config.clientKey}:${config.clientSecret}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${TOKEN_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new LuluApiError(`Connexion à Lulu impossible : ${shortError(error)}`, null, true);
  }

  if (!response.ok) {
    throw new LuluApiError(
      `Authentification Lulu refusée (statut ${response.status}). Vérifiez LULU_CLIENT_KEY, LULU_CLIENT_SECRET et LULU_ENV.`,
      response.status,
      response.status >= 500
    );
  }

  const data = asRecord(await response.json().catch(() => null));
  const token = data && typeof data.access_token === "string" ? data.access_token : null;

  if (!token) {
    throw new LuluApiError("Réponse d'authentification de Lulu inattendue.", response.status, false);
  }

  const expiresIn = data && typeof data.expires_in === "number" ? data.expires_in : 300;
  cachedToken = { value: token, expiresAt: now + expiresIn * 1000, baseUrl: config.baseUrl };

  return token;
}

async function luluRequest(
  config: LuluConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  alreadyRetried = false
): Promise<unknown> {
  const token = await fetchAccessToken(config);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new LuluApiError(`Appel à Lulu impossible : ${shortError(error)}`, null, true);
  }

  // Jeton expiré : on en redemande un, une seule fois.
  if (response.status === 401 && !alreadyRetried) {
    cachedToken = null;
    return luluRequest(config, method, path, body, true);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new LuluApiError(
      `Lulu a refusé la requête (statut ${response.status}) : ${text.replace(/\s+/g, " ").slice(0, 400)}`,
      response.status,
      response.status >= 500 || response.status === 429
    );
  }

  if (text === "") return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new LuluApiError("Réponse de Lulu illisible.", response.status, false);
  }
}

// ---------------------------------------------------------------------------
// Commande d'impression
// ---------------------------------------------------------------------------

export interface PrintJobAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  // Obligatoire pour certains pays (États-Unis, Canada, Australie...)
  stateCode?: string;
  postcode: string;
  // Code pays ISO 3166-1 alpha-2
  countryCode: string;
  phoneNumber: string;
}

export interface PrintJobLineInput {
  externalId: string;
  title: string;
  quantity: number;
  // Code de 27 caractères qui définit format, papier, reliure (catalogue de Lulu)
  podPackageId: string;
  // Adresses accessibles par Lulu (liens signés)
  interiorUrl: string;
  coverUrl: string;
}

export interface CreatePrintJobInput {
  externalId: string;
  contactEmail: string;
  shippingLevel: LuluShippingLevel;
  address: PrintJobAddress;
  lines: PrintJobLineInput[];
}

export interface LuluPrintJob {
  id: number;
  status: string;
  statusMessage: string | null;
  externalId: string | null;
  trackingUrls: string[];
}

function addressToLulu(address: PrintJobAddress): Record<string, string> {
  const result: Record<string, string> = {
    name: address.name,
    street1: address.street1,
    city: address.city,
    postcode: address.postcode,
    country_code: address.countryCode,
    phone_number: address.phoneNumber,
  };

  if (address.street2) result.street2 = address.street2;
  if (address.stateCode) result.state_code = address.stateCode;

  return result;
}

function parsePrintJob(value: unknown): LuluPrintJob {
  const record = asRecord(value);

  if (!record || typeof record.id !== "number") {
    throw new LuluApiError(
      "Réponse de Lulu inattendue : identifiant de commande d'impression absent.",
      null,
      false
    );
  }

  const status = asRecord(record.status);
  const statusName = status ? asStringOrNull(status.name) : null;
  const statusMessages = status ? status.messages : null;

  const trackingUrls: string[] = [];
  if (Array.isArray(record.line_items)) {
    for (const item of record.line_items) {
      const itemRecord = asRecord(item);
      if (itemRecord && Array.isArray(itemRecord.tracking_urls)) {
        for (const url of itemRecord.tracking_urls) {
          if (typeof url === "string") trackingUrls.push(url);
        }
      }
    }
  }

  return {
    id: record.id,
    status: statusName ?? "UNKNOWN",
    statusMessage: typeof statusMessages === "string" ? statusMessages : null,
    externalId: asStringOrNull(record.external_id),
    trackingUrls,
  };
}

/** Crée une commande d'impression chez Lulu (POST /print-jobs/). */
export async function createPrintJob(input: CreatePrintJobInput): Promise<LuluPrintJob> {
  const config = requireConfig();

  const body = {
    contact_email: input.contactEmail,
    external_id: input.externalId,
    line_items: input.lines.map((line) => ({
      external_id: line.externalId,
      title: line.title,
      quantity: line.quantity,
      printable_normalization: {
        pod_package_id: line.podPackageId,
        cover: { source_url: line.coverUrl },
        interior: { source_url: line.interiorUrl },
      },
    })),
    shipping_address: addressToLulu(input.address),
    shipping_level: input.shippingLevel,
  };

  return parsePrintJob(await luluRequest(config, "POST", "/print-jobs/", body));
}

/** Lit l'état d'une commande d'impression (GET /print-jobs/{id}/). */
export async function getPrintJob(printJobId: number): Promise<LuluPrintJob> {
  const config = requireConfig();

  if (!Number.isInteger(printJobId) || printJobId <= 0) {
    throw new LuluApiError("Identifiant de commande d'impression invalide.", null, false);
  }

  return parsePrintJob(await luluRequest(config, "GET", `/print-jobs/${printJobId}/`));
}

// ---------------------------------------------------------------------------
// Coûts et options de livraison (à valider dans le bac à sable)
// ---------------------------------------------------------------------------

export interface CostCalculationInput {
  shippingLevel: LuluShippingLevel;
  address: PrintJobAddress;
  lines: { podPackageId: string; pageCount: number; quantity: number }[];
}

export interface LuluCostEstimate {
  currency: string | null;
  totalCostExclTax: string | null;
  totalCostInclTax: string | null;
  shippingCostInclTax: string | null;
  raw: Record<string, unknown> | null;
}

/** Estime le coût d'impression et de livraison avant de fixer le prix payé par l'acheteur. */
export async function calculateCost(input: CostCalculationInput): Promise<LuluCostEstimate> {
  const config = requireConfig();

  const body = {
    line_items: input.lines.map((line) => ({
      page_count: line.pageCount,
      pod_package_id: line.podPackageId,
      quantity: line.quantity,
    })),
    shipping_address: addressToLulu(input.address),
    shipping_option: input.shippingLevel,
  };

  const record = asRecord(await luluRequest(config, "POST", "/print-job-cost-calculations/", body));
  const shipping = record ? asRecord(record.shipping_cost) : null;

  return {
    currency: record ? asStringOrNull(record.currency) : null,
    totalCostExclTax: record ? asStringOrNull(record.total_cost_excl_tax) : null,
    totalCostInclTax: record ? asStringOrNull(record.total_cost_incl_tax) : null,
    shippingCostInclTax: shipping ? asStringOrNull(shipping.total_cost_incl_tax) : null,
    raw: record,
  };
}

export interface LuluShippingOption {
  level: string;
  costExclTax: string | null;
  currency: string | null;
}

/** Liste les modes de livraison que Lulu propose vers un pays (permet de refuser un pays non desservi). */
export async function getShippingOptions(params: {
  countryCode: string;
  quantity?: number;
  podPackageId?: string;
  pageCount?: number;
  stateCode?: string;
}): Promise<LuluShippingOption[]> {
  const config = requireConfig();

  const query = new URLSearchParams({ country_code: params.countryCode });
  if (params.quantity !== undefined) query.set("quantity", String(params.quantity));
  if (params.podPackageId) query.set("pod_package_id", params.podPackageId);
  if (params.pageCount !== undefined) query.set("page_count", String(params.pageCount));
  if (params.stateCode) query.set("state_code", params.stateCode);

  const data = await luluRequest(config, "GET", `/shipping-options/?${query.toString()}`);

  const list: unknown[] = Array.isArray(data)
    ? data
    : (() => {
        const record = asRecord(data);
        return record && Array.isArray(record.results) ? record.results : [];
      })();

  const options: LuluShippingOption[] = [];

  for (const entry of list) {
    const record = asRecord(entry);
    const level = record ? asStringOrNull(record.level) : null;

    if (record && level) {
      options.push({
        level,
        costExclTax: asStringOrNull(record.cost_excl_tax),
        currency: asStringOrNull(record.currency),
      });
    }
  }

  return options;
  }
