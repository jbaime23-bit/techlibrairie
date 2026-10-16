// src/lib/health.ts
// Vérifications de la configuration et de l'état du site (page /admin/sante).
// Aucune valeur secrète n'est jamais renvoyée : uniquement des états (présent, absent, mode).

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
    // CORRECTION ICI : Remplacement de prisma.\$queryRaw par prisma.\$queryRaw
    await withTimeout(prisma.\$queryRaw`SELECT 1`, 6000);
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

  // Vérification uniquement des tables réellement existantes dans votre schema.prisma actuel
  const probes: [string, () => Promise<unknown>][] = [
    ["User", () => prisma.user.findFirst({ select: { id: true } })],
    ["SellerProfile", () => prisma.sellerProfile.findFirst({ select: { id: true } })],
    ["Product", () => prisma.product.findFirst({ select: { id: true } })],
    ["Order", () => prisma.order.findFirst({ select: { id: true } })],
    ["OrderItem", () => prisma.orderItem.findFirst({ select: { id: true } })],
    ["DownloadToken", () => prisma.downloadToken.findFirst({ select: { id: true } })],
    ["AccountToken", () => prisma.accountToken.findFirst({ select: { token: true } })],
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
        "Exécutez « npx prisma db push » pour synchroniser vos tables."
      )
    );
  }

  return { checks, reachable: failures.length < probes.length };
}

export async function buildHealthReport(): Promise<HealthSection[]> {
  const sections: HealthSection[] = [];
  
  // Section Base de données
  const { checks } = await checkDatabase();
  sections.push({ title: "Base de données Neon", checks });

  // Section Configuration générale
  const configChecks: HealthCheck[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  configChecks.push(
    appUrl 
      ? check("URL du site", "ok", `Définie sur : ${appUrl}`)
      : check("URL du site", "warning", "NEXT_PUBLIC_APP_URL non définie.", "Ajoutez-la dans Vercel.")
  );
  
  sections.push({ title: "Configuration Générale", checks: configChecks });

  return sections;
    }
