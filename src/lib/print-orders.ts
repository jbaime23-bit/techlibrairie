// src/lib/print-orders.ts
// Cœur du traitement des commandes d'exemplaires imprimés : validation du paiement et envoi.
//
// - Burkina Faso : envoi automatique BLOQUÉ -> la commande passe « À traiter localement ».
// - Étranger : requête POST automatique à Lulu (code d'impression, PDF signés, adresse du client).
// - Rien ne part sans LULU_AUTO_ENABLED ; une erreur laisse la commande visible, à relancer à la main.
//
// markPrintOrderPaid est la porte d'entrée unique d'un paiement validé : l'administration l'appelle
// aujourd'hui (paiement manuel) ; une passerelle de paiement (carte) l'appellera demain.

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { decideFulfilmentRoute } from "@/lib/fulfilment-routing";
import { fulfilPhysicalOrder } from "@/lib/fulfilment";
import { isLuluShippingLevel } from "@/lib/lulu";
import {
  notifyAdminsPrintDispatchError,
  notifyBuyerPrintPaid,
} from "@/lib/print-order-notifications";

const NUMBER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Numéro de commande lisible, par exemple LI-7K2M9QXD (sans caractères ambigus). */
export function generatePrintOrderNumber(): string {
  const bytes = randomBytes(8);
  let suffix = "";

  for (const byte of bytes) {
    suffix += NUMBER_ALPHABET[byte % NUMBER_ALPHABET.length];
  }

  return `LI-${suffix}`;
}

export interface DispatchOutcome {
  ok: boolean;
  message: string;
}

export interface MarkPaidOutcome extends DispatchOutcome {
  // Faux si la commande n'était plus à valider (aucun changement)
  paid: boolean;
}

async function failDispatch(orderId: string, message: string, notify: boolean): Promise<DispatchOutcome> {
  await prisma.printOrder.updateMany({
    where: { id: orderId, status: { in: ["PAID", "ERROR", "SENDING"] } },
    data: { status: "ERROR", lastDispatchError: message.slice(0, 1500) },
  });

  if (notify) {
    await notifyAdminsPrintDispatchError(orderId);
  }

  return { ok: false, message };
}

/** Envoie une commande payée : voie locale (Burkina Faso) ou requête automatique à Lulu (étranger). */
export async function dispatchPrintOrder(orderId: string): Promise<DispatchOutcome> {
  const order = await prisma.printOrder.findUnique({ where: { id: orderId } });

  if (!order) {
    return { ok: false, message: "Commande introuvable." };
  }
  if (order.status !== "PAID" && order.status !== "ERROR") {
    return { ok: false, message: "Cette commande n'est pas à envoyer." };
  }

  const decision = decideFulfilmentRoute(order.shipCountry);

  // Acheteur au Burkina Faso : envoi automatique bloqué, traitement local.
  if (decision.route === "LOCAL_MANUAL") {
    await prisma.printOrder.updateMany({
      where: { id: orderId, status: { in: ["PAID", "ERROR"] } },
      data: {
        status: "LOCAL_PENDING",
        route: decision.route,
        fulfilmentNote: decision.reason,
        lastDispatchError: null,
      },
    });

    return { ok: true, message: decision.reason };
  }

  if (decision.route === "BLOCKED_ADDRESS") {
    return failDispatch(orderId, decision.reason, true);
  }

  // Verrou : une seule tentative d'envoi à la fois, pour ne jamais créer deux commandes d'impression.
  const claimed = await prisma.printOrder.updateMany({
    where: { id: orderId, status: { in: ["PAID", "ERROR"] } },
    data: { status: "SENDING", route: decision.route },
  });

  if (claimed.count === 0) {
    return { ok: false, message: "Un envoi est déjà en cours pour cette commande." };
  }

  const edition = await prisma.printEdition.findUnique({ where: { productId: order.productId } });

  if (!edition || !edition.podPackageId || !edition.interiorStorageKey || !edition.coverStorageKey) {
    return failDispatch(
      orderId,
      "Configuration d'impression incomplète : code d'impression ou PDF manquant (Administration, Impression).",
      true
    );
  }

  const configuredLevel = process.env.LULU_SHIPPING_LEVEL?.trim() ?? "";

  const result = await fulfilPhysicalOrder({
    orderReference: order.number,
    shippingLevel: isLuluShippingLevel(configuredLevel) ? configuredLevel : undefined,
    address: {
      name: order.shipName,
      street1: order.shipStreet1,
      street2: order.shipStreet2 ?? undefined,
      city: order.shipCity,
      stateCode: order.shipState ?? undefined,
      postcode: order.shipPostcode,
      country: order.shipCountry,
      phone: order.shipPhone,
    },
    lines: [
      {
        externalId: `${order.number}-1`,
        title: order.productTitle,
        quantity: order.quantity,
        podPackageId: edition.podPackageId,
        interiorKey: edition.interiorStorageKey,
        coverKey: edition.coverStorageKey,
      },
    ],
  });

  if (result.ok && result.route === "LULU_AUTO") {
    try {
      await prisma.printOrder.update({
        where: { id: orderId },
        data: {
          status: "SENT_TO_LULU",
          luluPrintJobId: result.printJobId,
          luluStatus: result.status,
          dispatchedAt: new Date(),
          lastDispatchError: null,
        },
      });
    } catch (error) {
      // La commande d'impression existe chez Lulu : on garde son identifiant dans les journaux.
      console.error(
        `Commande ${order.number} : impression créée chez Lulu (identifiant ${result.printJobId}) mais enregistrement impossible :`,
        error
      );
      return { ok: false, message: `Commande créée chez Lulu (identifiant ${result.printJobId}), enregistrement échoué.` };
    }

    return { ok: true, message: `Commande transmise à Lulu (identifiant ${result.printJobId}).` };
  }

  if (!result.ok && result.route === "DISABLED") {
    // Envoi automatique désactivé : la commande reste « Payée », sans alerte, pour être envoyée plus tard.
    await prisma.printOrder.updateMany({
      where: { id: orderId, status: "SENDING" },
      data: { status: "PAID", lastDispatchError: result.error.slice(0, 1500) },
    });

    return { ok: false, message: result.error };
  }

  const message = result.ok ? "Réponse inattendue du traitement d'envoi." : result.error;
  return failDispatch(orderId, message, true);
}

/**
 * Valide le paiement d'une commande, puis lance son envoi.
 * Appelée par l'administration (paiement manuel) ou, plus tard, par une passerelle de paiement.
 */
export async function markPrintOrderPaid(orderId: string, validatedBy: string): Promise<MarkPaidOutcome> {
  const claimed = await prisma.printOrder.updateMany({
    where: { id: orderId, status: { in: ["PAYMENT_SUBMITTED", "AWAITING_PAYMENT"] } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paidValidatedBy: validatedBy,
      paymentRejectionReason: null,
    },
  });

  if (claimed.count === 0) {
    return { ok: false, paid: false, message: "Cette commande n'est plus à valider." };
  }

  await notifyBuyerPrintPaid(orderId);

  const outcome = await dispatchPrintOrder(orderId);
  return { ...outcome, paid: true };
}
