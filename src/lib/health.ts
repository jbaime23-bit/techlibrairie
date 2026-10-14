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
    ["User (colonne passwordChangedAt)", () => prisma.user.findFirst({ select: { id: true, passwordChangedAt: true } })],
    ["LoginAttempt", () => prisma.loginAttempt.findFirst({ select: { id: true } })],
    ["VerificationToken", () => prisma.verificationToken.findFirst({ select: { token: true } })],
    ["SellerProfile", () => prisma.sellerProfile.findFirst({ select: { id: true } })],
    ["Category", () => prisma.category.findFirst({ select: { id: true } })],
    ["Product", () => prisma.product.findFirst({ select: { id: true } })],
    ["Order", () => prisma.order.findFirst({ select: { id: true } })],
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
    checks.push(check("Tables de la base", "ok", "Toutes les tables attendues existent."));
  } else {
    checks.push(
      check(
        "Tables de la base",
        "error",
        `Éléments manquants ou inaccessibles : ${failures.join(", ")}.`,
        "Redéployez le site : la compilation exécute « prisma db push » qui crée les tables manquantes. Si l'erreur persiste, consultez les journaux de compilation Vercel."
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

  checks.push(
    process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16
      ? check("Maintenance automatique (CRON_SECRET)", "ok", "Tâche planifiée activée.")
      : check(
          "Maintenance automatique (CRON_SECRET)",
          "warning",
          "Absente ou trop courte : la maintenance quotidienne est désactivée.",
          "Ajoutez CRON_SECRET (16 caractères aléatoires au minimum) dans Vercel."
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

async function buildPaymentsSection(liveTests: boolean): Promise<HealthSection> {
  const checks: HealthCheck[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  if (!stripeKey) {
    checks.push(
      check(
        "Stripe (cartes bancaires)",
        "error",
        "STRIPE_SECRET_KEY absente.",
        "Ajoutez la clé secrète Stripe dans Vercel."
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
          "Avant l'ouverture au public, remplacez par la clé « live » et le secret du webhook correspondant."
        )
      );
    } else {
      checks.push(check("Stripe (cartes bancaires)", "error", "Format de clé inattendu.", "Vérifiez la clé copiée depuis Stripe."));
    }
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  checks.push(
    webhookSecret.startsWith("whsec_")
      ? check("Stripe : secret du webhook", "ok", "Secret présent.")
      : check(
          "Stripe : secret du webhook",
          "error",
          webhookSecret ? "Format inattendu." : "STRIPE_WEBHOOK_SECRET absent.",
          "Créez le webhook dans Stripe (adresse indiquée plus bas) et copiez son secret (commence par whsec_)."
        )
  );

  if (liveTests && stripeKey) {
    try {
      await withTimeout(getStripe().balance.retrieve(), 7000);
      checks.push(check("Stripe : test de connexion", "ok", "Stripe a répondu : la clé est valide."));
    } catch (error) {
      checks.push(
        check("Stripe : test de connexion", "error", `Échec : ${shortError(error)}`, "Vérifiez la clé secrète Stripe.")
      );
    }
  }

  const cinetPayReady = Boolean(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID);
  checks.push(
    cinetPayReady
      ? check(
          "CinetPay (Mobile Money)",
          "info",
          "Clé et identifiant du site présents. Leur validité et le passage en mode production ne peuvent pas être vérifiés ici.",
          "Faites un paiement Mobile Money de test avant l'ouverture."
        )
      : check(
          "CinetPay (Mobile Money)",
          "error",
          "CINETPAY_API_KEY ou CINETPAY_SITE_ID absent.",
          "Ajoutez-les dans Vercel (menu Intégrations de votre compte CinetPay)."
        )
  );

  try {
    const [eur, usd] = await Promise.all([getCardRate("EUR"), getCardRate("USD")]);
    checks.push(
      eur
        ? check("Taux de change : euro", "ok", "Disponible (parité fixe ou taux saisi).")
        : check("Taux de change : euro", "warning", "Indisponible.", "Saisissez un taux dans Administration, Taux de change.")
    );
    checks.push(
      usd
        ? check("Taux de change : dollar", "ok", "Taux valide.")
        : check(
            "Taux de change : dollar",
            "warning",
            "Aucun taux valide : le paiement par carte en dollars n'est pas proposé.",
            "Saisissez le taux du jour dans Administration, Taux de change (ou ignorez si vous n'offrez que l'euro)."
          )
    );
  } catch (error) {
    checks.push(check("Taux de change", "error", `Lecture impossible : ${shortError(error)}`));
  }

  if (appUrl) {
    checks.push(
      check("Webhook Stripe à déclarer", "info", `${appUrl}/api/webhooks/stripe`, "Événements : checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, charge.refunded.")
    );
    checks.push(
      check("Notification CinetPay", "info", `${appUrl}/api/webhooks/cinetpay`, "Envoyée automatiquement par le site à chaque transaction : rien à déclarer.")
    );
  }

  return { title: "Paiements", checks };
}

async function buildEmailSection(): Promise<HealthSection> {
  const checks: HealthCheck[] = [];

  if (!isEmailConfigured()) {
    checks.push(
      check(
        "Envoi d'emails (Resend)",
        "warning",
        "RESEND_API_KEY ou EMAIL_FROM absent : aucun email n'est envoyé.",
        "Voir la page Administration, Emails."
      )
    );
  } else {
    const from = process.env.EMAIL_FROM ?? "";
    if (from.toLowerCase().includes("resend.dev")) {
      checks.push(
        check(
          "Envoi d'emails (Resend)",
          "warning",
          "L'expéditeur utilise le domaine de test de Resend : les emails ne partent qu'à votre propre adresse.",
          "Vérifiez votre domaine dans Resend et utilisez une adresse de ce domaine."
        )
      );
    } else {
      checks.push(
        check(
          "Envoi d'emails (Resend)",
          "ok",
          "Configuré. Faites un envoi de test depuis Administration, Emails pour confirmer le domaine."
        )
      );
    }
  }

  try {
    const contact = await getContactInfo();
    checks.push(
      contact.email
        ? check("Email de contact", "ok", "Défini : il reçoit les alertes de l'équipe.")
        : check(
            "Email de contact",
            "warning",
            "Aucun email de contact défini : les alertes vont aux comptes administrateurs.",
            "Renseignez-le dans Administration, Paramètres."
          )
    );
    checks.push(
      contact.whatsappNumber
        ? check("WhatsApp", "ok", "Numéro défini.")
        : check("WhatsApp", "info", "Aucun numéro : le bouton WhatsApp n'est pas affiché.")
    );
  } catch (error) {
    checks.push(check("Contact", "error", `Lecture impossible : ${shortError(error)}`));
  }

  return { title: "Emails et contact", checks };
}

async function buildStorageSection(liveTests: boolean): Promise<HealthSection> {
  const checks: HealthCheck[] = [];

  checks.push(
    process.env.BLOB_READ_WRITE_TOKEN
      ? check("Stockage privé des PDF", "ok", "Jeton présent.")
      : check(
          "Stockage privé des PDF",
          "warning",
          "BLOB_READ_WRITE_TOKEN absent.",
          "Acceptable seulement si le store privé est relié au projet Vercel. Sinon, ajoutez le jeton : les vendeurs ne pourront pas envoyer de PDF."
        )
  );

  checks.push(
    process.env.BLOB_PUBLIC_READ_WRITE_TOKEN
      ? check("Stockage public (couvertures, bannières)", "ok", "Jeton présent.")
      : check(
          "Stockage public (couvertures, bannières)",
          "warning",
          "BLOB_PUBLIC_READ_WRITE_TOKEN absent : impossible d'envoyer des couvertures ou des bannières.",
          "Créez le store public et ajoutez son jeton dans Vercel."
        )
  );

  if (liveTests) {
    try {
      await withTimeout(get("pdfs/.verification-sante", { access: "private" }), 8000);
      checks.push(check("Stockage privé : test de connexion", "ok", "Le service de stockage a répondu."));
    } catch (error) {
      checks.push(
        check(
          "Stockage privé : test de connexion",
          "error",
          `Échec : ${shortError(error)}`,
          "Vérifiez le store privé et son jeton."
        )
      );
    }
  }

  return { title: "Stockage des fichiers", checks };
}

async function buildContentSection(reachable: boolean): Promise<HealthSection> {
  const checks: HealthCheck[] = [];

  const legalMissing = missingLegalFields(getLegalConfig());
  checks.push(
    legalMissing.length === 0
      ? check("Informations légales", "ok", "Nom et adresse de l'exploitant renseignés.")
      : check(
          "Informations légales",
          "warning",
          `À renseigner : ${legalMissing.join(" ; ")}.`,
          "Ajoutez ces variables dans Vercel, puis faites relire les pages légales par un juriste."
        )
  );

  if (reachable) {
    try {
      const [products, sellers, ads] = await Promise.all([
        prisma.product.count({ where: { status: "PUBLISHED" } }),
        prisma.sellerProfile.count({ where: { status: "ACTIVE" } }),
        prisma.adSpace.count({ where: { isActive: true } }),
      ]);

      checks.push(
        products > 0
          ? check("Catalogue", "ok", `${products} ouvrage(s) en vente.`)
          : check("Catalogue", "info", "Aucun ouvrage en vente pour le moment.")
      );
      checks.
