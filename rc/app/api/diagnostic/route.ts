// src/app/api/diagnostic/route.ts
// OUTIL TEMPORAIRE DE DIAGNOSTIC : à supprimer dès que le site fonctionne.
// Il n'affiche aucune valeur secrète : seulement des états (présent/absent, oui/non).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EXPECTED_ENV = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "CINETPAY_API_KEY",
  "CINETPAY_SITE_ID",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_PUBLIC_READ_WRITE_TOKEN",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CRON_SECRET",
];

const EXPECTED_TABLES = [
  "User",
  "Account",
  "Session",
  "VerificationToken",
  "LoginAttempt",
  "AuditLog",
  "SellerProfile",
  "Category",
  "Product",
  "Review",
  "Favorite",
  "PromoCode",
  "Order",
  "OrderItem",
  "Payment",
  "ExchangeRate",
  "DownloadToken",
  "Payout",
  "SupportThread",
  "Message",
  "SupportPayment",
  "ContactMessage",
  "AdSpace",
  "PlatformSetting",
];

const EXPECTED_COLUMNS: [string, string][] = [
  ["User", "totpEnabledAt"],
  ["User", "reminderEmails"],
  ["User", "passwordChangedAt"],
  ["Product", "ratingAverage"],
  ["Order", "promoCodeId"],
  ["Order", "reminderSentAt"],
  ["OrderItem", "listAmount"],
];

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
  return message.replace(/\s+/g, " ").slice(0, 200);
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    return { connexion: "non", erreur: "DATABASE_URL absente" };
  }

  try {
    const tables = await withTimeout(
      prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      `,
      8000
    );
    const columns = await withTimeout(
      prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
        SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
      `,
      8000
    );

    const tableNames = new Set(tables.map((row) => row.table_name));
    const columnKeys = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));

    return {
      connexion: "oui",
      tablesManquantes: EXPECTED_TABLES.filter((name) => !tableNames.has(name)),
      colonnesManquantes: EXPECTED_COLUMNS.filter(
        ([table, column]) => !columnKeys.has(`${table}.${column}`)
      ).map(([table, column]) => `${table}.${column}`),
    };
  } catch (error) {
    return { connexion: "non", erreur: shortError(error) };
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { "user-agent": "diagnostic-techlibrairie" },
  });
  const text = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    text,
  };
}

async function checkHomePage(origin: string) {
  try {
    const home = await fetchText(`${origin}/`);
    const text = visibleText(home.text);

    const links = (home.text.match(/<link[^>]*>/gi) ?? []).filter(
      (tag) => /stylesheet/i.test(tag) && /href=/i.test(tag)
    );
    const hrefs = links
      .map((tag) => /href="([^"]+)"/i.exec(tag)?.[1])
      .filter((href): href is string => Boolean(href))
      .slice(0, 3);

    const stylesheets = [];
    for (const href of hrefs) {
      try {
        const url = href.startsWith("http") ? href : `${origin}${href}`;
        const css = await fetchText(url);
        stylesheets.push({
          fichier: href,
          statut: css.status,
          typeContenu: css.contentType,
          tailleOctets: css.text.length,
          contientDirectivesBrutes: /@tailwind/.test(css.text),
          contientSortieTailwind: /--tw-/.test(css.text),
          contientClassesDuSite:
            css.text.includes(".container-page") && css.text.includes(".btn-primary"),
        });
      } catch (error) {
        stylesheets.push({ fichier: href, erreur: shortError(error) });
      }
    }

    return {
      statutPageAccueil: home.status,
      texteVisibleDebut: text,
      nombreFichiersDeDesign: hrefs.length,
      fichiersDeDesign: stylesheets,
    };
  } catch (error) {
    return { erreur: shortError(error) };
  }
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const variables: Record<string, boolean> = {};
  for (const name of EXPECTED_ENV) {
    variables[name] = Boolean(process.env[name]?.trim());
  }

  const [baseDeDonnees, pageAccueil] = await Promise.all([
    checkDatabase(),
    checkHomePage(origin),
  ]);

  const conclusions: string[] = [];

  const missingVariables = Object.entries(variables)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  if (missingVariables.length > 0) {
    conclusions.push(`Variables absentes dans Vercel : ${missingVariables.join(", ")}.`);
  }

  if (baseDeDonnees.connexion === "non") {
    conclusions.push("La base de données ne répond pas : vérifiez DATABASE_URL (Neon).");
  } else {
    if ((baseDeDonnees.tablesManquantes ?? []).length > 0) {
      conclusions.push(
        `Tables manquantes dans la base : ${baseDeDonnees.tablesManquantes?.join(", ")}. Le déploiement doit exécuter « prisma db push ».`
      );
    }
    if ((baseDeDonnees.colonnesManquantes ?? []).length > 0) {
      conclusions.push(
        `Colonnes manquantes dans la base : ${baseDeDonnees.colonnesManquantes?.join(", ")}. Le déploiement doit exécuter « prisma db push ».`
      );
    }
  }

  if ("erreur" in pageAccueil) {
    conclusions.push(`Impossible de lire la page d'accueil : ${pageAccueil.erreur}`);
  } else {
    const text = pageAccueil.texteVisibleDebut;

    if (pageAccueil.statutPageAccueil !== 200 || /application error|server-side exception|momentanément indisponible/i.test(text)) {
      conclusions.push(
        "La page d'accueil renvoie une ERREUR SERVEUR. Ouvrez Vercel, Logs (Runtime Logs) : l'erreur exacte y est inscrite. Envoyez-la moi."
      );
    }

    if (pageAccueil.nombreFichiersDeDesign === 0) {
      conclusions.push(
        "Aucun fichier de design n'est chargé par la page : vérifiez que src/app/layout.tsx contient la ligne import \"./globals.css\"; et que src/app/globals.css existe."
      );
    }

    for (const sheet of pageAccueil.fichiersDeDesign) {
      if ("erreur" in sheet) continue;

      if (sheet.statut !== 200) {
        conclusions.push(`Le fichier de design ${sheet.fichier} ne se charge pas (statut ${sheet.statut}).`);
      } else if (sheet.contientDirectivesBrutes) {
        conclusions.push(
          "Le design contient encore les lignes @tailwind non transformées : le fichier postcss.config.mjs est absent ou mal placé (il doit être à la racine du dépôt, à côté de package.json)."
        );
      } else if (!sheet.contientSortieTailwind) {
        conclusions.push(
          "Tailwind n'a rien généré : le fichier tailwind.config.ts est absent ou mal placé (racine du dépôt), ou globals.css ne commence pas par les trois lignes @tailwind."
        );
      } else if (!sheet.contientClassesDuSite) {
        conclusions.push(
          "Tailwind fonctionne mais les classes du site sont absentes : vérifiez la ligne content de tailwind.config.ts (elle doit contenir ./src/**/*.{js,ts,jsx,tsx,mdx})."
        );
      }
    }
  }

  if (conclusions.length === 0) {
    conclusions.push(
      "Rien d'anormal côté serveur : le design est bien généré. Rechargez le site en navigation privée (le navigateur garde peut-être l'ancienne version en mémoire)."
    );
  }

  const report = {
    conclusions,
    variables,
    baseDeDonnees,
    pageAccueil,
  };

  return new NextResponse(JSON.stringify(report, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
