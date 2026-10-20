// src/lib/admin-alerts.ts
// Alertes de seuil pour les administrateurs : calcul, email et envoi automatique.
//
// Alertes : versements en attente, support sans réponse, messages de contact non traités,
// espace de la base de données, taux du dollar périmé (seulement si Stripe est configuré).
//
// Envoi automatique (tâche quotidienne) : jamais s'il n'y a aucune alerte ; au plus un email par jour ;
// si les alertes sont les mêmes que lors du dernier envoi, un rappel seulement tous les 3 jours.
// Les envois sont consignés dans le journal (action "alerte.envoyee").

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  getEmailAppUrl,
  isEmailConfigured,
  sendEmail,
  type EmailItem,
  type SendResult,
} from "@/lib/email";
import { getCardRate } from "@/lib/fx";
import { formatPrice } from "@/lib/utils";

export const PAYOUT_WAIT_HOURS = 48;
export const SUPPORT_WAIT_HOURS = 24;
export const CONTACT_WAIT_HOURS = 48;
export const DB_WARNING_PERCENT = 80;
export const DB_CRITICAL_PERCENT = 95;

const HOUR_MS = 3_600_000;
const DEFAULT_DB_LIMIT_MB = 512;
const MIN_DB_LIMIT_MB = 50;
const MIN_HOURS_BETWEEN_EMAILS = 20;
const REPEAT_HOURS = 72;
const MAX_ADMIN_RECIPIENTS = 5;

export type AlertSeverity = "warning" | "critical";

export interface AdminAlert {
  // Identifiant stable ; il change quand le niveau de gravité change (ex. "db-80" puis "db-95")
  key: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  // Page de l'administration où traiter le problème
  href: string;
}

export interface DatabaseUsage {
  bytes: number;
  limitMb: number;
  percent: number;
  // Faux si la limite par défaut (512 Mo) est utilisée faute de variable DB_STORAGE_LIMIT_MB
  limitFromEnv: boolean;
}

/** Durée écoulée en français, ex. "3 jours" ou "5 heures". */
function ageLabel(since: Date, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - since.getTime()) / HOUR_MS));
  if (hours >= 48) return `${Math.floor(hours / 24)} jours`;
  return `${hours} heure${hours > 1 ? "s" : ""}`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count > 1 ? pluralForm : singular;
}

/** Espace utilisé dans la base de données (estimation), ou null si la mesure est impossible. */
export async function getDatabaseUsage(): Promise<DatabaseUsage | null> {
  try {
    const rows = await prisma.$queryRaw<{ size: bigint }[]>`
      SELECT pg_database_size(current_database()) AS size
    `;
    const bytes = Number(rows[0]?.size ?? 0);

    const fromEnv = Number.parseInt(process.env.DB_STORAGE_LIMIT_MB ?? "", 10);
    const limitFromEnv = Number.isFinite(fromEnv) && fromEnv >= MIN_DB_LIMIT_MB;
    const limitMb = limitFromEnv ? fromEnv : DEFAULT_DB_LIMIT_MB;

    return {
      bytes,
      limitMb,
      percent: (bytes / (limitMb * 1024 * 1024)) * 100,
      limitFromEnv,
    };
  } catch (error) {
    console.error("Mesure de l'espace de la base impossible :", error);
    return null;
  }
}

/** Calcule les alertes en cours. */
export async function computeAdminAlerts(now: Date = new Date()): Promise<AdminAlert[]> {
  const alerts: AdminAlert[] = [];

  const payoutLimit = new Date(now.getTime() - PAYOUT_WAIT_HOURS * HOUR_MS);
  const supportLimit = new Date(now.getTime() - SUPPORT_WAIT_HOURS * HOUR_MS);
  const contactLimit = new Date(now.getTime() - CONTACT_WAIT_HOURS * HOUR_MS);

  const [payouts, support, contacts, usage] = await Promise.all([
    prisma.payout.aggregate({
      where: { status: "PENDING", currency: "XOF", requestedAt: { lt: payoutLimit } },
      _count: { _all: true },
      _sum: { amount: true },
      _min: { requestedAt: true },
    }),
    prisma.supportThread.aggregate({
      where: { status: "OPEN", lastMessageAt: { lt: supportLimit } },
      _count: { _all: true },
      _min: { lastMessageAt: true },
    }),
    prisma.contactMessage.aggregate({
      where: { status: "NEW", createdAt: { lt: contactLimit } },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    getDatabaseUsage(),
  ]);

  const payoutCount = payouts._count._all;
  if (payoutCount > 0 && payouts._min.requestedAt) {
    const oldest = payouts._min.requestedAt;
    const veryOld = now.getTime() - oldest.getTime() > 7 * 24 * HOUR_MS;

    alerts.push({
      key: "versements",
      severity: veryOld ? "critical" : "warning",
      title: `${payoutCount} demande${plural(payoutCount, "", "s")} de versement en attente`,
      detail: `${formatPrice(payouts._sum.amount ?? 0, "XOF")} à verser. La plus ancienne attend depuis ${ageLabel(oldest, now)} (seuil : ${PAYOUT_WAIT_HOURS} heures).`,
      href: "/admin/versements",
    });
  }

  const supportCount = support._count._all;
  if (supportCount > 0 && support._min.lastMessageAt) {
    const oldest = support._min.lastMessageAt;
    const veryOld = now.getTime() - oldest.getTime() > 72 * HOUR_MS;

    alerts.push({
      key: "support",
      severity: veryOld ? "critical" : "warning",
      title: `${supportCount} conversation${plural(supportCount, "", "s")} de support sans réponse`,
      detail: `Des clients ont payé et attendent une réponse. La plus ancienne attend depuis ${ageLabel(oldest, now)} (seuil : ${SUPPORT_WAIT_HOURS} heures).`,
      href: "/admin/support",
    });
  }

  const contactCount = contacts._count._all;
  if (contactCount > 0 && contacts._min.createdAt) {
    alerts.push({
      key: "contact",
      severity: "warning",
      title: `${contactCount} message${plural(contactCount, "", "s")} de contact non traité${plural(contactCount, "", "s")}`,
      detail: `Le plus ancien est arrivé il y a ${ageLabel(contacts._min.createdAt, now)} (seuil : ${CONTACT_WAIT_HOURS} heures).`,
      href: "/admin/messages",
    });
  }

  if (usage && usage.percent >= DB_WARNING_PERCENT) {
    const critical = usage.percent >= DB_CRITICAL_PERCENT;
    const usedMb = usage.bytes / (1024 * 1024);

    alerts.push({
      key: critical ? "db-95" : "db-80",
      severity: critical ? "critical" : "warning",
      title: `Base de données remplie à ${Math.round(usage.percent)} %`,
      detail: `Environ ${usedMb.toFixed(0)} Mo utilisés sur ${usage.limitMb} Mo${usage.limitFromEnv ? "" : " (limite supposée du plan gratuit : définissez DB_STORAGE_LIMIT_MB si votre plan est différent)"}. Quand la limite est atteinte, la base peut refuser les écritures : passez à un plan supérieur chez Neon avant.`,
      href: "/admin/sante",
    });
  }

  // Taux du dollar : seulement utile si le paiement par carte via Stripe est configuré.
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      const usd = await getCardRate("USD");
      if (!usd) {
        alerts.push({
          key: "taux-usd",
          severity: "warning",
          title: "Taux du dollar absent ou périmé",
          detail:
            "Le paiement par carte en dollars est suspendu tant qu'un taux de moins de 60 jours n'est pas saisi.",
          href: "/admin/taux",
        });
      }
    } catch (error) {
      console.error("Alertes : lecture du taux du dollar impossible :", error);
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/** Envoie la liste des alertes par email à une adresse. */
export async function sendAlertsEmail(
  alerts: AdminAlert[],
  to: string,
  idempotencyKey: string
): Promise<SendResult> {
  const appUrl = getEmailAppUrl();
  if (!appUrl || !isEmailConfigured()) {
    return { ok: false, error: "Envoi d'emails indisponible (configuration manquante)." };
  }

  const critical = alerts.filter((alert) => alert.severity === "critical").length;

  const items: EmailItem[] = alerts.map((alert) => ({
    label: `${alert.severity === "critical" ? "URGENT : " : ""}${alert.title}`,
    detail: alert.detail,
    url: `${appUrl}${alert.href}`,
  }));

  return sendEmail({
    to,
    subject: `Alertes TechLibrairie : ${alerts.length} point${plural(alerts.length, "", "s")} à traiter${critical > 0 ? " (dont urgent)" : ""}`,
    idempotencyKey,
    content: {
      title: "Alertes de la boutique",
      paragraphs: [
        `${alerts.length} point${plural(alerts.length, " demande", "s demandent")} votre attention. Cliquez sur un point pour ouvrir la page concernée.`,
      ],
      items,
      button: { label: "Voir toutes les alertes", url: `${appUrl}/admin/alertes` },
      note: "Vous recevez cet email au plus une fois par jour, et seulement quand une alerte est en cours. Si la situation ne change pas, un rappel est envoyé tous les 3 jours.",
    },
  });
}

// ---------------------------------------------------------------------------
// Envoi automatique
// ---------------------------------------------------------------------------

export type AdminAlertsStatus =
  | "aucune-alerte"
  | "deja-envoye"
  | "inchange"
  | "email-indisponible"
  | "aucun-destinataire"
  | "echec"
  | "envoye";

export interface AdminAlertsOutcome {
  status: AdminAlertsStatus;
  alerts: number;
  sent: number;
}

function readSignature(details: unknown): string | null {
  if (typeof details === "object" && details !== null && !Array.isArray(details)) {
    const signature = (details as Record<string, unknown>).signature;
    if (typeof signature === "string") return signature;
  }
  return null;
}

/** Envoie les alertes aux administrateurs si c'est le moment (appelée chaque jour par la tâche planifiée). */
export async function sendAdminAlertsIfDue(now: Date = new Date()): Promise<AdminAlertsOutcome> {
  const alerts = await computeAdminAlerts(now);

  if (alerts.length === 0) return { status: "aucune-alerte", alerts: 0, sent: 0 };

  if (!isEmailConfigured() || !getEmailAppUrl()) {
    return { status: "email-indisponible", alerts: alerts.length, sent: 0 };
  }

  const signature = alerts
    .map((alert) => alert.key)
    .sort()
    .join(",");

  const last = await prisma.auditLog.findFirst({
    where: { action: "alerte.envoyee" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, details: true },
  });

  if (last) {
    const hoursSince = (now.getTime() - last.createdAt.getTime()) / HOUR_MS;

    if (hoursSince < MIN_HOURS_BETWEEN_EMAILS) {
      return { status: "deja-envoye", alerts: alerts.length, sent: 0 };
    }
    if (readSignature(last.details) === signature && hoursSince < REPEAT_HOURS) {
      return { status: "inchange", alerts: alerts.length, sent: 0 };
    }
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    take: MAX_ADMIN_RECIPIENTS,
    select: { id: true, email: true },
  });

  if (admins.length === 0) {
    return { status: "aucun-destinataire", alerts: alerts.length, sent: 0 };
  }

  const dayKey = now.toISOString().slice(0, 10);
  let sent = 0;

  for (const admin of admins) {
    const result = await sendAlertsEmail(alerts, admin.email, `admin-alerts-${dayKey}-${admin.id}`);
    if (result.ok) sent += 1;
  }

  // Si aucun email n'a pu partir, rien n'est consigné : nouvelle tentative lors de la prochaine exécution.
  if (sent === 0) return { status: "echec", alerts: alerts.length, sent: 0 };

  await recordAudit({
    adminId: null,
    adminEmail: "systeme",
    action: "alerte.envoyee",
    targetType: "alerte",
    details: { signature, nombre: alerts.length, destinataires: sent },
  });

  return { status: "envoye", alerts: alerts.length, sent };
}
