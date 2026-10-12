// src/lib/maintenance.ts
// Tâches de maintenance : commandes abandonnées, conversations de support jamais payées,
// jetons expirés et fichiers PDF orphelins.
// Mode "à blanc" (dryRun) : compte ce qui serait traité sans rien modifier ni supprimer.
// Chaque exécution est limitée dans le temps ; ce qui reste est traité à la suivante.

import { del, list } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { syncOrderPayments } from "@/lib/orders";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const ABANDONED_ORDER_HOURS = 48;
const UNPAID_SUPPORT_DAYS = 14;
const LOGIN_ATTEMPT_HOURS = 24;
const OLD_DOWNLOAD_TOKEN_DAYS = 30;
const ORPHAN_PDF_MIN_AGE_DAYS = 7;

const MAX_ORDERS_PER_RUN = 30;
const MAX_ORPHANS_DELETED_PER_RUN = 100;
const DEFAULT_BUDGET_MS = 7000;

export type OrphanScanStatus = "ok" | "partiel" | "indisponible";

export interface MaintenanceReport {
  dryRun: boolean;
  abandonedOrdersCanceled: number;
  abandonedOrdersRecovered: number;
  unpaidSupportThreadsDeleted: number;
  expiredTokensDeleted: number;
  oldLoginAttemptsDeleted: number;
  oldDownloadTokensDeleted: number;
  orphanPdfsFound: number;
  orphanPdfsDeleted: number;
  orphanScan: OrphanScanStatus;
  timeBudgetExceeded: boolean;
  durationMs: number;
}

async function handleAbandonedOrders(
  dryRun: boolean,
  deadline: number,
  report: MaintenanceReport
): Promise<void> {
  const cutoff = new Date(Date.now() - ABANDONED_ORDER_HOURS * HOUR_MS);

  const staleOrders = await prisma.order.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: MAX_ORDERS_PER_RUN,
    select: { id: true },
  });

  for (const order of staleOrders) {
    if (Date.now() > deadline) {
      report.timeBudgetExceeded = true;
      break;
    }

    if (dryRun) {
      report.abandonedOrdersCanceled += 1;
      continue;
    }

    // Avant d'annuler, on revérifie auprès du prestataire : un paiement
    // validé entre-temps est alors confirmé normalement.
    await syncOrderPayments(order.id);

    const fresh = await prisma.order.findUnique({
      where: { id: order.id },
      select: { status: true },
    });

    if (fresh?.status === "PAID") {
      report.abandonedOrdersRecovered += 1;
      continue;
    }

    if (fresh?.status === "PENDING") {
      await prisma.$transaction([
        prisma.payment.updateMany({
          where: { orderId: order.id, status: "PENDING" },
          data: { status: "CANCELED" },
        }),
        prisma.order.updateMany({
          where: { id: order.id, status: "PENDING" },
          data: { status: "CANCELED" },
        }),
      ]);
      report.abandonedOrdersCanceled += 1;
    }
  }
}

async function handleUnpaidSupportThreads(
  dryRun: boolean,
  report: MaintenanceReport
): Promise<void> {
  const where = {
    status: "AWAITING_PAYMENT" as const,
    createdAt: { lt: new Date(Date.now() - UNPAID_SUPPORT_DAYS * DAY_MS) },
    payments: { none: { status: { in: ["PENDING", "SUCCEEDED"] as ("PENDING" | "SUCCEEDED")[] } } },
  };

  if (dryRun) {
    report.unpaidSupportThreadsDeleted = await prisma.supportThread.count({ where });
    return;
  }

  const result = await prisma.supportThread.deleteMany({ where });
  report.unpaidSupportThreadsDeleted = result.count;
}

async function handleExpiredRecords(
  dryRun: boolean,
  report: MaintenanceReport
): Promise<void> {
  const now = new Date();
  const tokenWhere = { expires: { lt: now } };
  const attemptsWhere = {
    createdAt: { lt: new Date(Date.now() - LOGIN_ATTEMPT_HOURS * HOUR_MS) },
  };
  const downloadsWhere = {
    expiresAt: { lt: new Date(Date.now() - OLD_DOWNLOAD_TOKEN_DAYS * DAY_MS) },
  };

  if (dryRun) {
    report.expiredTokensDeleted = await prisma.verificationToken.count({ where: tokenWhere });
    report.oldLoginAttemptsDeleted = await prisma.loginAttempt.count({ where: attemptsWhere });
    report.oldDownloadTokensDeleted = await prisma.downloadToken.count({ where: downloadsWhere });
    return;
  }

  report.expiredTokensDeleted = (await prisma.verificationToken.deleteMany({ where: tokenWhere })).count;
  report.oldLoginAttemptsDeleted = (await prisma.loginAttempt.deleteMany({ where: attemptsWhere })).count;
  report.oldDownloadTokensDeleted = (await prisma.downloadToken.deleteMany({ where: downloadsWhere })).count;
}

/** Cherche les PDF du stockage privé qui ne sont rattachés à aucun produit (depuis plus de 7 jours). */
async function scanOrphanPdfs(
  deadline: number
): Promise<{ orphans: string[]; status: OrphanScanStatus }> {
  const products = await prisma.product.findMany({ select: { pdfStorageKey: true } });
  const referenced = new Set(products.map((product) => product.pdfStorageKey));
  const cutoff = new Date(Date.now() - ORPHAN_PDF_MIN_AGE_DAYS * DAY_MS);

  const orphans: string[] = [];
  let cursor: string | undefined;
  let complete = true;

  do {
    if (Date.now() > deadline) {
      complete = false;
      break;
    }

    const page = await list({ prefix: "pdfs/", cursor, limit: 500 });

    for (const blob of page.blobs) {
      if (!referenced.has(blob.pathname) && blob.uploadedAt < cutoff) {
        orphans.push(blob.pathname);
      }
    }

    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return { orphans, status: complete ? "ok" : "partiel" };
}

async function handleOrphanPdfs(
  dryRun: boolean,
  deadline: number,
  report: MaintenanceReport
): Promise<void> {
  try {
    const { orphans, status } = await scanOrphanPdfs(deadline);

    report.orphanScan = status;
    report.orphanPdfsFound = orphans.length;

    if (dryRun || orphans.length === 0) return;

    const toDelete = orphans.slice(0, MAX_ORPHANS_DELETED_PER_RUN);

    for (let index = 0; index < toDelete.length; index += 20) {
      if (Date.now() > deadline) {
        report.timeBudgetExceeded = true;
        break;
      }
      const chunk = toDelete.slice(index, index + 20);
      await del(chunk);
      report.orphanPdfsDeleted += chunk.length;
    }
  } catch (error) {
    console.error("Maintenance : nettoyage des PDF orphelins impossible :", error);
    report.orphanScan = "indisponible";
  }
}

/** Lance la maintenance. Ne lève jamais d'exception : chaque tâche est isolée. */
export async function runMaintenance(options: {
  dryRun: boolean;
  budgetMs?: number;
}): Promise<MaintenanceReport> {
  const startedAt = Date.now();
  const deadline = startedAt + (options.budgetMs ?? DEFAULT_BUDGET_MS);

  const report: MaintenanceReport = {
    dryRun: options.dryRun,
    abandonedOrdersCanceled: 0,
    abandonedOrdersRecovered: 0,
    unpaidSupportThreadsDeleted: 0,
    expiredTokensDeleted: 0,
    oldLoginAttemptsDeleted: 0,
    oldDownloadTokensDeleted: 0,
    orphanPdfsFound: 0,
    orphanPdfsDeleted: 0,
    orphanScan: "ok",
    timeBudgetExceeded: false,
    durationMs: 0,
  };

  const tasks: { name: string; run: () => Promise<void> }[] = [
    { name: "commandes abandonnées", run: () => handleAbandonedOrders(options.dryRun, deadline, report) },
    { name: "support non payé", run: () => handleUnpaidSupportThreads(options.dryRun, report) },
    { name: "données expirées", run: () => handleExpiredRecords(options.dryRun, report) },
    { name: "PDF orphelins", run: () => handleOrphanPdfs(options.dryRun, deadline, report) },
  ];

  for (const task of tasks) {
    try {
      await task.run();
    } catch (error) {
      console.error(`Maintenance : la tâche « ${task.name} » a échoué :`, error);
    }
  }

  report.durationMs = Date.now() - startedAt;
  return report;
              }
