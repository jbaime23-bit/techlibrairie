// src/lib/health.ts
// Vérifications de la configuration et de l'état du site (page /admin/sante).
// Aucune valeur secrète n'est jamais renvoyée : uniquement des états (présent, absent, mode).

import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getContactInfo } from "@/lib/contact";
import { getCardRate } from "@/lib/fx";
import { getLegalConfig, missingLegalFields } from "@/lib/legal-config";
import { getStripe } from "@/lib/stripe";
import { isEmailConfigured } from "@/lib/email";
import { computeAdminAlerts, getDatabaseUsage } from "@/lib/admin-alerts";
import { SCHEDULED_TASKS, getLastTaskRun } from "@/lib/task-heartbeat";

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

/** Durée écoulée en français, ex. "il y a 5 heures" ou "il y a 3 jours". */
function ageText(hours: number): string {
  if (hours < 1) return "il y a moins d'une heure";
  if (hours < 48) {
    const rounded = Math.floor(hours);
    return `il y a ${rounded} heure${rounded > 1 ? "s" : ""}`;
  }
  return `il y a ${Math.floor(hours / 24)} jours`;
}

/** Version de Next.js installée (null si illisible). */
async function readNextVersion(): Promise<string | null> {
  try {
    const mod = (await import("next/package.json")) as {
      default?: { version?: string };
      version?: string;
    };
    return mod.default?.version ?? mod.version ?? null;
  } catch {
    return null;
  }
}

function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

async function checkDatabase(): Promise<{ checks: HealthCheck[]; reachable: boolean }> {
  const checks: HealthCheck[] = [];

  if (!process.env.DATABASE_URL) {
    checks.push(
      check(
        "Connexion à la base de données",
        "error",
        "La variable DATABASE_URL est absente.",
        "Ajoutez DATABASE_URL (adresse de connexion Neon) dans Vercel, Environment Variables, puis redéployez."
      )
    );
    return { checks, reachable: false };
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
    return { checks, reachable: false };
  }

  const probes: [string, () => Promise<unknown>][] = [
    [
      "User (colonnes de sécurité et de rappel)",
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
      "Product (colonnes de note)",
      () =>
        prisma.product.findFirst({
          select: { id: true, ratingAverage: true, ratingCount: true },
        }),
    ],
    ["Review (avis)", () => prisma.review.findFirst({ select: { id: true } })],
    ["Favorite (favoris)", () => prisma.favorite.findFirst({ select: { id: true } })],
    ["PromoCode (codes promotionnels)", () => prisma.promoCode.findFirst({ select: { id: true } })],
    [
      "Order (colonnes de code promotionnel et de rappel)",
      () =>
        prisma.order.findFirst({
          select: { id: true, promoCodeId: true, discountAmount: true, reminderSentAt: true },
        }),
    ],
    [
      "OrderItem (colonnes de remise)",
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
      check("Tables et colonnes de la base", "ok", "Toutes les tables et colonnes attendues existent.")
    );
  } else {
    checks.push(
      check(
        "Tables et colonnes de la base",
        "error",
        `Éléments manquants ou inaccessibles : ${failures.join(", ")}.`,
        "Redéployez le site : la compilation exécute « prisma db push » qui crée les tables et colonnes manquantes. Si l'erreur persiste, consultez les journaux de compilation Vercel (Deployments, Build Logs)."
      )
    );
  }

  return { checks, reachable: failures.length < probes.length };
}

async function buildBaseSection(): Promise<{ section: HealthSection; reachable: boolean }> {
  const { checks, reachable } = await checkDatabase();

  if (reachable) {
    try {
      const [settings, adminCount, categoryCount] = await Promise.all([
        prisma.platformSetting.findUnique({ where: { id: "global" } }),
        prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
        prisma.category.count(),
      ]);

      checks.push(
        settings
          ? check("Paramètres de la plateforme", "ok", "Les paramètres sont initialisés.")
          : check(
              "Paramètres de la plateforme",
              "warning",
              "Aucune ligne de paramètres : les valeurs par défaut s'appliquent.",
              "Enregistrez les paramètres une première fois depuis Administration, Paramètres."
            )
      );

      checks.push(
        adminCount > 0
          ? check("Compte administrateur", "ok", `${adminCount} compte(s) administrateur actif(s).`)
          : check("Compte administrateur", "error", "Aucun administrateur actif.", "Utilisez la page /initialisation.")
      );

      checks.push(
        categoryCount > 0
          ? check("Catégories", "ok", `${categoryCount} catégorie(s) disponible(s).`)
          : check(
              "Catégories",
              "warning",
              "Aucune catégorie : les vendeurs ne pourront pas classer leurs ouvrages.",
              "Utilisez la page /initialisation (si elle n'est pas encore verrouillée) ou contactez-moi."
            )
      );
    } catch (error) {
      checks.push(check("Lecture des données", "error", `Lecture impossible : ${shortError(error)}`));
    }

    const usage = await getDatabaseUsage();
    if (usage) {
      const usedMb = (usage.bytes / (1024 * 1024)).toFixed(0);
      const percent = Math.round(usage.percent);
      const status: HealthStatus =
        usage.percent >= 95 ? "error" : usage.percent >= 80 ? "warning" : "ok";

      checks.push(
        check(
          "Espace de la base de données",
          status,
          `Environ ${usedMb} Mo utilisés sur ${usage.limitMb} Mo (${percent} %).${
            usage.limitFromEnv
              ? ""
              : " La limite est celle supposée du plan gratuit : si votre plan est différent, définissez DB_STORAGE_LIMIT_MB."
          }`,
          status === "ok"
            ? undefined
            : "Passez à un plan supérieur chez Neon avant que la limite soit atteinte (la base peut alors refuser les écritures)."
        )
      );
    } else {
      checks.push(
        check("Espace de la base de données", "info", "Mesure impossible pour le moment.")
      );
    }
  }

  return { section: { title: "Base de données et configuration", checks }, reachable };
}

async function buildSecuritySection(): Promise<HealthSection> {
  const checks: HealthCheck[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const authUrl = process.env.NEXTAUTH_URL?.replace(/\/+$/, "") ?? "";

  if (!appUrl) {
    checks.push(
      check(
        "Adresse du site (NEXT_PUBLIC_APP_URL)",
        "error",
        "Variable absente : les paiements, emails et liens ne fonctionneront pas.",
        "Ajoutez NEXT_PUBLIC_APP_URL (par exemple https://votre-domaine.com) dans Vercel."
      )
    );
  } else if (isProduction && !appUrl.startsWith("https://")) {
    checks.push(
      check(
        "Adresse du site (NEXT_PUBLIC_APP_URL)",
        "error",
        "L'adresse n'est pas en https.",
        "Utilisez l'adresse https de votre site."
      )
    );
  } else {
    checks.push(check("Adresse du site (NEXT_PUBLIC_APP_URL)", "ok", `Définie : ${appUrl}`));
  }

  if (!authUrl) {
    checks.push(
      check(
        "Adresse d'authentification (NEXTAUTH_URL)",
        "error",
        "Variable absente : la connexion peut échouer.",
        "Ajoutez NEXTAUTH_URL avec la même adresse que NEXT_PUBLIC_APP_URL."
      )
    );
  } else if (appUrl && authUrl !== appUrl) {
    checks.push(
      check(
        "Adresse d'authentification (NEXTAUTH_URL)",
        "warning",
        `Différente de NEXT_PUBLIC_APP_URL (${authUrl}).`,
        "Les deux variables doivent contenir exactement la même adresse."
      )
    );
  } else {
    checks.push(check("Adresse d'authentification (NEXTAUTH_URL)", "ok", "Cohérente avec l'adresse du site."));
  }

  const secret = process.env.NEXTAUTH_SECRET ?? "";
  if (!secret) {
    checks.push(
      check("Secret d'authentification (NEXTAUTH_SECRET)", "error", "Variable absente.", "Ajoutez un secret long et aléatoire.")
    );
  } else if (secret.startsWith("remplacez-par") || secret.length < 16) {
    checks.push(
      check(
        "Secret d'authentification (NEXTAUTH_SECRET)",
        "error",
        "Valeur d'exemple ou trop courte.",
        "Remplacez-la par un secret aléatoire d'au moins 32 caractères."
      )
    );
  } else if (secret.length < 32) {
    checks.push(
      check(
        "Secret d'authentification (NEXTAUTH_SECRET)",
        "warning",
        "Secret correct mais court.",
        "Préférez un secret aléatoire d'au moins 32 caractères."
      )
    );
  } else {
    checks.push(check("Secret d'authentification (NEXTAUTH_SECRET)", "ok", "Secret présent et suffisamment long."));
  }

  try {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (process.env.SETUP_SECRET && adminCount > 0) {
      checks.push(
        check(
          "Code d'initialisation (SETUP_SECRET)",
          "warning",
          "Encore défini alors que la plateforme est initialisée.",
          "Supprimez la variable SETUP_SECRET dans Vercel : elle n'a plus d'utilité."
        )
      );
    } else {
      checks.push(check("Code d'initialisation (SETUP_SECRET)", "ok", "Pas de code d'initialisation actif inutile."));
    }
  } catch {
    // Information indisponible si la base ne répond pas : déjà signalé ailleurs.
  }

  // Double authentification des administrateurs.
  if (process.env.RESET_2FA_EMAIL?.trim()) {
    checks.push(
      check(
        "Variable de secours RESET_2FA_EMAIL",
        "error",
        "Elle est présente dans Vercel : le compte concerné se connecte avec le seul mot de passe et sa double authentification est effacée à chaque connexion.",
        "Une fois votre accès rétabli, supprimez cette variable dans Vercel, redéployez, puis réactivez la double authentification."
      )
    );
  } else {
    checks.push(
      check("Variable de secours RESET_2FA_EMAIL", "ok", "Absente (c'est le bon état normal).")
    );
  }

  if (process.env.ADMIN_2FA_REQUIRED === "false") {
    checks.push(
      check(
        "Double authentification obligatoire",
        "warning",
        "La variable ADMIN_2FA_REQUIRED vaut « false » : les administrateurs peuvent travailler sans double authentification.",
        "Supprimez la variable ADMIN_2FA_REQUIRED dans Vercel pour rendre la double authentification de nouveau obligatoire."
      )
    );
  } else {
    try {
      const withoutTwoFactor = await prisma.user.count({
        where: { role: "ADMIN", isActive: true, totpEnabledAt: null },
      });
      checks.push(
        withoutTwoFactor === 0
          ? check(
              "Double authentification des administrateurs",
              "ok",
              "Tous les administrateurs actifs l'ont activée."
            )
          : check(
              "Double authentification des administrateurs",
              "warning",
              `${withoutTwoFactor} administrateur(s) actif(s) ne l'ont pas encore activée (ils sont redirigés vers la page de sécurité à chaque accès).`,
              "Chaque administrateur doit l'activer depuis Administration, Sécurité du compte, et noter ses codes de secours."
            )
      );
    } catch {
      // Information indisponible si la base ne répond pas : déjà signalé ailleurs.
    }
  }

  checks.push(
    process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16
      ? check("Tâches planifiées (CRON_SECRET)", "ok", "Secret présent : les tâches planifiées sont activées.")
      : check(
          "Tâches planifiées (CRON_SECRET)",
          "warning",
          "Absent ou trop court : la maintenance, les rappels, le rapport mensuel et les alertes sont désactivés.",
          "Ajoutez CRON_SECRET (16 caractères aléatoires au minimum) dans Vercel, puis redéployez."
        )
  );

  const nextVersion = await readNextVersion();
  const parsed = nextVersion ? parseVersion(nextVersion) : null;

  if (!nextVersion || !parsed) {
    checks.push(check("Version de Next.js", "info", "Version illisible."));
  } else {
    const [major, minor, patch] = parsed;
    const upToDate =
      major >= 16 || (major === 15 && (minor > 5 || (minor === 5 && patch >= 26)));

    checks.push(
      upToDate
        ? check("Version de Next.js", "ok", `Version ${nextVersion} (à jour au moment de l'écriture).`)
        : check(
            "Version de Next.js",
            major < 15 ? "error" : "warning",
            `Version ${nextVersion}.`,
            "Mettez à jour Next.js vers la version 15.5.26 ou plus récente (versions antérieures : failles de sécurité publiées)."
          )
    );
  }

  return { title: "Sécurité", checks };
}

async function buildScheduleSection(reachable: boolean): Promise<HealthSection> {
  const checks: HealthCheck[] = [];
  const now = Date.now();
  const secretOk = Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16);

  if (!secretOk) {
    checks.push(
      check(
        "Tâches planifiées",
        "warning",
        "CRON_SECRET est absent ou trop court : les tâches quotidiennes sont désactivées.",
        "Ajoutez CRON_SECRET (16 caractères aléatoires au minimum) dans Vercel, puis redéployez."
      )
    );
  }

  if (reachable) {
    for (const item of SCHEDULED_TASKS) {
      try {
        const last = await getLastTaskRun(item.task);

        if (!last) {
          checks.push(
            check(
              item.label,
              secretOk ? "info" : "warning",
              "Aucune exécution enregistrée pour le moment. C'est normal juste après la mise en ligne : elle s'exécute chaque jour.",
              "Si ce message persiste plus de 2 jours, ouvrez Vercel, Settings, Cron Jobs : la tâche doit y être listée (fichier vercel.json à la racine du dépôt)."
            )
          );
          continue;
        }

        const hours = (now - last.getTime()) / 3_600_000;

        if (hours <= 36) {
          checks.push(check(item.label, "ok", `Dernière exécution ${ageText(hours)}.`));
        } else {
          checks.push(
            check(
              item.label,
              hours <= 72 ? "warning" : "error",
              `Dernière exécution ${ageText(hours)} : elle devrait avoir lieu chaque jour.`,
              "Vérifiez dans Vercel, Settings, Cron Jobs, que la tâche est listée, que CRON_SECRET est défini et que le fichier vercel.json est bien à la racine du dépôt. Consultez aussi les journaux (Logs)."
            )
          );
        }
      } catch (error) {
        checks.push(check(item.label, "error", `Lecture impossible : ${shortError(error)}`));
      }
    }

    try {
      const alerts = await computeAdminAlerts();
      checks.push(
        alerts.length === 0
          ? check("Alertes d'administration", "ok", "Aucune alerte en cours.")
          : check(
              "Alertes d'administration",
              alerts.some((alert) => alert.severity === "critical") ? "error" : "warning",
              `${alerts.length} alerte(s) en cours (versements, support, contact ou espace de la base).`,
              "Ouvrez Administration, Alertes, pour les détails et les liens de traitement."
            )
      );
    } catch (error) {
      checks.push(
        check("Alertes d'administration", "info", `Calcul impossible : ${shortError(error)}`)
      );
    }
  }

  return { title: "Tâches planifiées et alertes", checks };
}

async function buildPaymentsSection(liveTests: boolean): Promise<HealthSection> {
  const checks: HealthCheck[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  if (!stripeKey) {
    checks.push(
      check(
        "Stripe (cartes bancaires)",
        "info",
        "Non configuré (STRIPE_SECRET_KEY absente) : le paiement par carte via Stripe n'est pas proposé.",
        "Normal si vous lancez en Mobile Money seul ou avec la carte CinetPay."
      )
    );
  } else {
    const isLive = stripeKey.startsWith("sk_live_") || stripeKey.startsWith("rk_live_");
    const isTest = stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_");

    if (isLive) {
      checks.push(check("Stripe (cartes bancaires)", "ok", "Clé en mode PRODUCTION : les paiements sont réels."));
    } else if (isTest) {
      checks.push(
        check(
          "Stripe (cartes bancaires)",
          "warning",
          "Clé en mode TEST : aucun vrai paiement ne peut être encaissé.",
          "Avant l'ouverture au public, remplacez par la clé « live » et le
