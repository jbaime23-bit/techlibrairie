// src/lib/health.ts
// Version simplifiée et autonome de la page Santé du site.
// Elle vérifie la base de données (tables et colonnes) et les variables d'environnement.
// Aucune valeur secrète n'est jamais renvoyée : uniquement des états.

import { prisma } from "@/lib/prisma";

export type HealthStatus = "ok" | "warning" | "error" | "info";

export interface HealthCheck {
  label: string;
  status: HealthStatus;
  detail: string;
  fix?: string;
}

export interface HealthSection {
  title: string;
  checks: HealthCheck[];
}

function check(
  label: string,
  status: HealthStatus,
  detail: string,
  fix?: string
): HealthCheck {
  return { label, status, detail, fix };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Délai dépassé")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : "erreur inconnue";
  return message.replace(/\s+/g, " ").slice(0, 160);
}

function hasEnv(name: string): boolean {
  return Boolean(process.env[name] && process.env[name]?.trim());
}

async function databaseSection(): Promise<HealthSection> {
  const checks: HealthCheck[] = [];

  if (!hasEnv("DATABASE_URL")) {
    checks.push(
      check(
        "Connexion à la base de données",
        "error",
        "La variable DATABASE_URL est absente.",
        "Ajoutez DATABASE_URL (adresse de connexion Neon) dans Vercel, Settings, Environment Variables, puis redéployez."
      )
    );
    return { title: "Base de données", checks };
  }

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 6000);
    checks.push(check("Connexion à la base de données", "ok", "La base répond."));
  } catch (error) {
    checks.push(
      check(
        "Connexion à la base de données",
        "error",
        `Connexion impossible : ${shortError(error)}`,
        "Vérifiez DATABASE_URL dans Vercel et que la base Neon n'est pas suspendue."
      )
    );
    return { title: "Base de données", checks };
  }

  const probes: [string, () => Promise<unknown>][] = [
    [
      "User (sécurité et rappels)",
      () =>
        prisma.user.findFirst({
          select: {
            id: true,
            passwordChangedAt: true,
            totpSecretEnc: true,
            totpEnabledAt: true,
            reminderEmails: true,
          },
        }),
    ],
    ["LoginAttempt", () => prisma.loginAttempt.findFirst({ select: { id: true } })],
    ["VerificationToken", () => prisma.verificationToken.findFirst({ select: { token: true } })],
    ["AuditLog (journal)", () => prisma.auditLog.findFirst({ select: { id: true } })],
    ["SellerProfile", () => prisma.sellerProfile.findFirst({ select: { id: true } })],
    ["Category", () => prisma.category.findFirst({ select: { id: true } })],
    [
      "Product (notes)",
      () =>
        prisma.product.findFirst({
          select: { id: true, ratingAverage: true, ratingCount: true },
        }),
    ],
    ["Review (avis)", () => prisma.review.findFirst({ select: { id: true } })],
    ["Favorite (favoris)", () => prisma.favorite.findFirst({ select: { id: true } })],
    ["PromoCode (codes promotionnels)", () => prisma.promoCode.findFirst({ select: { id: true } })],
    [
      "Order (code promotionnel et rappel)",
      () =>
        prisma.order.findFirst({
          select: { id: true, promoCodeId: true, discountAmount: true, reminderSentAt: true },
        }),
    ],
    [
      "OrderItem (remises)",
      () =>
        prisma.orderItem.findFirst({
          select: { id: true, listAmount: true, discountAmount: true },
        }),
    ],
    ["Payment", () => prisma.payment.findFirst({ select: { id: true } })],
    ["ExchangeRate", () => prisma.exchangeRate.findFirst({ select: { id: true } })],
    ["DownloadToken", () => prisma.downloadToken.findFirst({ select: { id: true } })],
    ["Payout", () => prisma.payout.findFirst({ select: { id: true } })],
    ["SupportThread", () => prisma.supportThread.findFirst({ select: { id: true } })],
    ["Message", () => prisma.message.findFirst({ select: { id: true } })],
    ["SupportPayment", () => prisma.supportPayment.findFirst({ select: { id: true } })],
    ["ContactMessage", () => prisma.contactMessage.findFirst({ select: { id: true } })],
    ["AdSpace", () => prisma.adSpace.findFirst({ select: { id: true } })],
    ["PlatformSetting", () => prisma.platformSetting.findFirst({ select: { id: true } })],
  ];

  const failures: string[] = [];
  for (const [name, probe] of probes) {
    try {
      await withTimeout(probe(), 6000);
    } catch {
      failures.push(name);
    }
  }

  if (failures.length === 0) {
    checks.push(
      check("Tables et colonnes", "ok", "Toutes les tables et colonnes attendues existent.")
    );
  } else {
    checks.push(
      check(
        "Tables et colonnes",
        "error",
        `Éléments manquants ou inaccessibles : ${failures.join(", ")}.`,
        "Vérifiez que la commande de compilation de Vercel contient « prisma db push », puis redéployez sans le cache."
      )
    );
  }

  try {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    checks.push(
      adminCount > 0
        ? check("Compte administrateur", "ok", `${adminCount} compte(s) administrateur actif(s).`)
        : check("Compte administrateur", "error", "Aucun administrateur actif.", "Utilisez la page /initialisation.")
    );
  } catch (error) {
    checks.push(check("Compte administrateur", "error", `Lecture impossible : ${shortError(error)}`));
  }

  return { title: "Base de données", checks };
}

function configurationSection(): HealthSection {
  const checks: HealthCheck[] = [];

  const required: { name: string; label: string; level: "error" | "warning" }[] = [
    { name: "NEXT_PUBLIC_APP_URL", label: "Adresse du site", level: "error" },
    { name: "NEXTAUTH_URL", label: "Adresse d'authentification", level: "error" },
    { name: "NEXTAUTH_SECRET", label: "Secret d'authentification", level: "error" },
    { name: "CINETPAY_API_KEY", label: "CinetPay : clé d'API", level: "error" },
    { name: "CINETPAY_SITE_ID", label: "CinetPay : identifiant du site", level: "error" },
    { name: "BLOB_READ_WRITE_TOKEN", label: "Stockage privé des PDF", level: "warning" },
    { name: "BLOB_PUBLIC_READ_WRITE_TOKEN", label: "Stockage public des images", level: "warning" },
    { name: "RESEND_API_KEY", label: "Emails : clé Resend", level: "warning" },
    { name: "EMAIL_FROM", label: "Emails : expéditeur", level: "warning" },
    { name: "CRON_SECRET", label: "Tâches planifiées", level: "warning" },
  ];

  for (const item of required) {
    if (hasEnv(item.name)) {
      checks.push(check(`${item.label} (${item.name})`, "ok", "Variable présente."));
    } else {
      checks.push(
        check(
          `${item.label} (${item.name})`,
          item.level,
          "Variable absente.",
          "Ajoutez-la dans Vercel, Settings, Environment Variables, puis redéployez."
        )
      );
    }
  }

  const secret = process.env.NEXTAUTH_SECRET ?? "";
  if (secret && secret.length < 32) {
    checks.push(
      check(
        "Longueur du secret d'authentification",
        "warning",
        "Le secret est court.",
        "Préférez un secret aléatoire d'au moins 32 caractères."
      )
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const authUrl = process.env.NEXTAUTH_URL?.replace(/\/+$/, "") ?? "";
  if (appUrl && authUrl && appUrl !== authUrl) {
    checks.push(
      check(
        "Cohérence des adresses",
        "warning",
        "NEXT_PUBLIC_APP_URL et NEXTAUTH_URL sont différentes.",
        "Elles doivent contenir exactement la même adresse."
      )
    );
  }

  checks.push(
    hasEnv("STRIPE_SECRET_KEY") && hasEnv("STRIPE_WEBHOOK_SECRET")
      ? check("Stripe", "info", "Configuré (clé et secret du webhook présents).")
      : check("Stripe", "info", "Non configuré : la carte via Stripe n'est pas proposée.")
  );

  checks.push(
    process.env.CINETPAY_CARD_ENABLED === "true"
      ? check("Carte via CinetPay", "info", "Activée (CINETPAY_CARD_ENABLED vaut true).")
      : check("Carte via CinetPay", "info", "Désactivée.")
  );

  if (hasEnv("SETUP_SECRET")) {
    checks.push(
      check(
        "Code d'initialisation (SETUP_SECRET)",
        "warning",
        "Encore défini.",
        "Supprimez-le dans Vercel une fois la plateforme initialisée."
      )
    );
  }

  if (hasEnv("RESET_2FA_EMAIL")) {
    checks.push(
      check(
        "Variable de secours RESET_2FA_EMAIL",
        "error",
        "Elle est présente : la double authentification est contournée pour ce compte.",
        "Supprimez cette variable dans Vercel, redéployez, puis réactivez la double authentification."
      )
    );
  }

  if (process.env.ADMIN_2FA_REQUIRED === "false") {
    checks.push(
      check(
        "Double authentification obligatoire",
        "warning",
        "ADMIN_2FA_REQUIRED vaut « false ».",
        "Supprimez cette variable pour rendre la double authentification obligatoire."
      )
    );
  }

  return { title: "Configuration (variables d'environnement)", checks };
}

/** Lance les vérifications. Le paramètre liveTests est conservé pour compatibilité avec la page. */
export async function runHealthChecks(options: {
  liveTests: boolean;
}): Promise<HealthSection[]> {
  void options;

  const database = await databaseSection();
  const configuration = configurationSection();

  return [database, configuration];
}
