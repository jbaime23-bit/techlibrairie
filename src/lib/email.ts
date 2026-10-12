// src/lib/email.ts
// Envoi d'emails transactionnels via l'API Resend (sans dépendance supplémentaire).
// Règle absolue : sendEmail ne lève jamais d'exception. Un email raté ne doit
// jamais empêcher un paiement, un remboursement ou un versement.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RECIPIENTS = 5;
const BRAND_COLOR = "#1d60f1";

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export interface EmailItem {
  label: string;
  detail?: string;
  url?: string;
}

export interface EmailContent {
  title: string;
  paragraphs?: string[];
  items?: EmailItem[];
  button?: { label: string; url: string };
  note?: string;
}

/** URL publique du site, sans barre finale (null si non définie). */
export function getEmailAppUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

/** Vrai si la clé Resend et l'adresse d'expédition sont renseignées. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Protège un texte avant de l'insérer dans du HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Construit la version HTML et la version texte d'un email. */
export function renderEmail(content: EmailContent): { html: string; text: string } {
  const paragraphs = content.paragraphs ?? [];
  const items = content.items ?? [];

  const paragraphsHtml = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#1e293b;">${escapeHtml(paragraph)}</p>`
    )
    .join("");

  const itemsHtml =
    items.length > 0
      ? `<ul style="margin:0 0 18px;padding:0 0 0 18px;font-size:15px;line-height:1.6;color:#1e293b;">${items
          .map((item) => {
            if (item.url) {
              const detail = item.detail ? ` - ${escapeHtml(item.detail)}` : "";
              return `<li><a href="${escapeHtml(item.url)}" style="color:${BRAND_COLOR};">${escapeHtml(item.label)}</a>${detail}</li>`;
            }
            const detail = item.detail ? ` : ${escapeHtml(item.detail)}` : "";
            return `<li><strong>${escapeHtml(item.label)}</strong>${detail}</li>`;
          })
          .join("")}</ul>`
      : "";

  const buttonHtml = content.button
    ? `<p style="margin:22px 0;"><a href="${escapeHtml(content.button.url)}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;font-size:15px;">${escapeHtml(content.button.label)}</a></p>`
    : "";

  const noteHtml = content.note
    ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#475569;">${escapeHtml(content.note)}</p>`
    : "";

  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;"><p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:${BRAND_COLOR};">TechLibrairie</p><h1 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${escapeHtml(content.title)}</h1>${paragraphsHtml}${itemsHtml}${buttonHtml}${noteHtml}<p style="margin:24px 0 0;font-size:12px;color:#64748b;">Message automatique de TechLibrairie.</p></div></body></html>`;

  const textLines: string[] = [content.title, ""];
  for (const paragraph of paragraphs) {
    textLines.push(paragraph, "");
  }
  for (const item of items) {
    const detail = item.detail ? ` : ${item.detail}` : "";
    const url = item.url ? ` (${item.url})` : "";
    textLines.push(`- ${item.label}${detail}${url}`);
  }
  if (items.length > 0) textLines.push("");
  if (content.button) {
    textLines.push(`${content.button.label} : ${content.button.url}`, "");
  }
  if (content.note) {
    textLines.push(content.note, "");
  }
  textLines.push("Message automatique de TechLibrairie.");

  return { html, text: textLines.join("\n") };
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  content: EmailContent;
  // Clé qui empêche l'envoi en double d'un même email (valable 24 heures chez Resend).
  idempotencyKey?: string;
  replyTo?: string;
}

/** Envoie un email. Ne lève jamais d'exception. */
export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Envoi d'emails non configuré (RESEND_API_KEY ou EMAIL_FROM manquant).",
    };
  }

  const rawRecipients = Array.isArray(params.to) ? params.to : [params.to];
  const recipients = Array.from(
    new Set(
      rawRecipients
        .map((address) => address.trim().toLowerCase())
        .filter((address) => address.length > 0)
    )
  ).slice(0, MAX_RECIPIENTS);

  if (recipients.length === 0) {
    return { ok: false, error: "Aucun destinataire." };
  }

  const subject = params.subject.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  const { html, text } = renderEmail(params.content);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (params.idempotencyKey) {
    headers["Idempotency-Key"] = params.idempotencyKey.slice(0, 256);
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body: unknown = await response.json().catch(() => null);

    if (response.ok) {
      const id = isRecord(body) && typeof body.id === "string" ? body.id : null;
      return { ok: true, id };
    }

    // 409 : la même clé a déjà servi, l'email est donc déjà parti.
    if (response.status === 409) {
      return { ok: true, id: null };
    }

    const message =
      isRecord(body) && typeof body.message === "string"
        ? body.message
        : `Réponse inattendue du service d'emails (HTTP ${response.status}).`;

    console.error(`Email : échec d'envoi (${subject}) : ${message}`);
    return { ok: false, error: message };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue lors de l'envoi.";
    console.error(`Email : échec d'envoi (${subject}) : ${message}`);
    return { ok: false, error: message };
  }
             }
