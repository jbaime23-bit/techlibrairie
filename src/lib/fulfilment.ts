// src/lib/fulfilment.ts
// Traitement d'une commande de livres imprimés à la demande.
//
// - Burkina Faso : envoi automatique BLOQUÉ -> voie "LOCAL_MANUAL" (aucun appel à Lulu).
// - Étranger : requête POST /print-jobs/ vers Lulu avec les PDF (liens signés) et l'adresse du client.
// - Rien ne part si LULU_AUTO_ENABLED n'est pas "true".
//
// Cette fonction ne touche pas la base de données : l'appelant doit enregistrer le résultat (identifiant
// de la commande d'impression) AVANT tout nouvel essai, pour ne jamais imprimer deux fois la même commande.
// Fichier autonome, non branché sur le site.

import { decideFulfilmentRoute } from "@/lib/fulfilment-routing";
import { isLuluFileKey, signLuluFileUrl } from "@/lib/lulu-files";
import {
  LuluApiError,
  createPrintJob,
  getLuluConfig,
  isLuluAutoEnabled,
  type LuluShippingLevel,
} from "@/lib/lulu";

export interface FulfilmentAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  stateCode?: string;
  postcode: string;
  // Pays tel que saisi : code à deux lettres de préférence (liste déroulante côté commande)
  country: string;
  phone: string;
}

export interface FulfilmentLine {
  // Référence unique de la ligne (par exemple l'identifiant de la ligne de commande)
  externalId: string;
  title: string;
  quantity: number;
  podPackageId: string;
  // Clés de stockage des PDF d'impression, dans le dossier lulu/ du store privé
  interiorKey: string;
  coverKey: string;
}

export interface FulfilmentRequest {
  // Référence de la commande TechLibrairie (numéro de commande)
  orderReference: string;
  // Adresse de contact du commerçant ; par défaut LULU_CONTACT_EMAIL
  contactEmail?: string;
  shippingLevel?: LuluShippingLevel;
  address: FulfilmentAddress;
  lines: FulfilmentLine[];
}

export type FulfilmentResult =
  | {
      ok: true;
      route: "LULU_AUTO";
      printJobId: number;
      status: string;
      externalId: string;
    }
  | {
      ok: true;
      route: "LOCAL_MANUAL";
      reason: string;
    }
  | {
      ok: false;
      route: "LULU_AUTO" | "BLOCKED_ADDRESS" | "DISABLED" | "INVALID_REQUEST";
      error: string;
      // Vrai si un nouvel essai a un sens (panne réseau ou de Lulu) ; faux si la demande doit être corrigée
      retryable: boolean;
    };

const MAX_LINES = 10;
const MAX_QUANTITY = 20;
const COUNTRIES_WITH_STATE = ["US", "CA", "AU"];

function validateAddress(address: FulfilmentAddress, countryCode: string): string | null {
  if (address.name.trim().length < 2) return "Nom du destinataire manquant.";
  if (address.street1.trim().length < 3) return "Adresse (rue) manquante.";
  if (address.city.trim().length < 2) return "Ville manquante.";
  if (address.postcode.trim().length < 2 || address.postcode.trim().length > 12) {
    return "Code postal manquant ou invalide.";
  }

  const digits = address.phone.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20) {
    return "Numéro de téléphone manquant ou invalide (exigé par le transporteur).";
  }

  if (COUNTRIES_WITH_STATE.includes(countryCode) && !address.stateCode?.trim()) {
    return `État ou province manquant (obligatoire pour le pays ${countryCode}).`;
  }

  return null;
}

function validateLines(lines: FulfilmentLine[]): string | null {
  if (lines.length === 0) return "Aucun livre imprimé dans la commande.";
  if (lines.length > MAX_LINES) return `Trop de lignes (${MAX_LINES} au maximum).`;

  for (const line of lines) {
    if (!line.externalId || line.externalId.length > 64) {
      return "Référence de ligne manquante ou trop longue.";
    }
    if (line.title.trim().length === 0 || line.title.length > 255) {
      return `Titre invalide pour la ligne ${line.externalId}.`;
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      return `Quantité invalide pour la ligne ${line.externalId} (de 1 à ${MAX_QUANTITY}).`;
    }
    if (!/^[0-9A-Z]{27}$/.test(line.podPackageId)) {
      return `Code d'impression (pod_package_id) invalide pour la ligne ${line.externalId} : 27 caractères attendus.`;
    }
    if (!isLuluFileKey(line.interiorKey) || !isLuluFileKey(line.coverKey)) {
      return `Fichiers d'impression invalides pour la ligne ${line.externalId} : ils doivent se trouver dans le dossier lulu/.`;
    }
  }

  return null;
}

/** Traite une commande de livres imprimés : voie locale (Burkina Faso) ou envoi automatique à Lulu (étranger). */
export async function fulfilPhysicalOrder(request: FulfilmentRequest): Promise<FulfilmentResult> {
  const decision = decideFulfilmentRoute(request.address.country);

  if (decision.route === "LOCAL_MANUAL") {
    return { ok: true, route: "LOCAL_MANUAL", reason: decision.reason };
  }

  if (decision.route === "BLOCKED_ADDRESS" || !decision.countryCode) {
    return { ok: false, route: "BLOCKED_ADDRESS", error: decision.reason, retryable: false };
  }

  const countryCode = decision.countryCode;

  if (!isLuluAutoEnabled()) {
    return {
      ok: false,
      route: "DISABLED",
      error:
        "L'envoi automatique vers Lulu est désactivé : LULU_AUTO_ENABLED doit valoir « true » et les clés Lulu doivent être configurées.",
      retryable: false,
    };
  }

  const orderReference = request.orderReference.trim();
  if (orderReference.length === 0 || orderReference.length > 60) {
    return {
      ok: false,
      route: "INVALID_REQUEST",
      error: "Référence de commande manquante ou trop longue.",
      retryable: false,
    };
  }

  const addressError = validateAddress(request.address, countryCode);
  if (addressError) {
    return { ok: false, route: "INVALID_REQUEST", error: addressError, retryable: false };
  }

  const linesError = validateLines(request.lines);
  if (linesError) {
    return { ok: false, route: "INVALID_REQUEST", error: linesError, retryable: false };
  }

  const contactEmail = request.contactEmail?.trim() || getLuluConfig()?.contactEmail || "";
  if (!contactEmail) {
    return {
      ok: false,
      route: "INVALID_REQUEST",
      error: "Adresse de contact du commerçant absente : définissez LULU_CONTACT_EMAIL.",
      retryable: false,
    };
  }

  const externalId = `TL-${orderReference}`;

  try {
    const printJob = await createPrintJob({
      externalId,
      contactEmail,
      shippingLevel: request.shippingLevel ?? "MAIL",
      address: {
        name: request.address.name.trim(),
        street1: request.address.street1.trim(),
        street2: request.address.street2?.trim() || undefined,
        city: request.address.city.trim(),
        stateCode: request.address.stateCode?.trim() || undefined,
        postcode: request.address.postcode.trim(),
        countryCode,
        phoneNumber: request.address.phone.trim(),
      },
      lines: request.lines.map((line) => ({
        externalId: line.externalId,
        title: line.title.trim(),
        quantity: line.quantity,
        podPackageId: line.podPackageId,
        interiorUrl: signLuluFileUrl(line.interiorKey),
        coverUrl: signLuluFileUrl(line.coverKey),
      })),
    });

    return {
      ok: true,
      route: "LULU_AUTO",
      printJobId: printJob.id,
      status: printJob.status,
      externalId,
    };
  } catch (error) {
    if (error instanceof LuluApiError) {
      return { ok: false, route: "LULU_AUTO", error: error.message, retryable: error.retryable };
    }

    return {
      ok: false,
      route: "LULU_AUTO",
      error: error instanceof Error ? error.message : "Erreur inconnue lors de l'envoi à Lulu.",
      retryable: false,
    };
  }
  }
