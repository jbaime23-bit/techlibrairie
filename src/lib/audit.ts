// src/lib/audit.ts
// Journal des actions d'administration. Ne lève jamais d'exception :
// un échec d'écriture du journal ne doit jamais bloquer l'action elle-même.
// Ne jamais y enregistrer de secret (mot de passe, code, clé).

import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashClientIp } from "@/lib/login-throttle";

export interface AuditEvent {
  adminId: string | null;
  adminEmail: string;
  // Code d'action en minuscules, ex. "commande.remboursee"
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Prisma.InputJsonObject;
  ipHash?: string | null;
}

export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: event.adminId,
        adminEmail: event.adminEmail.slice(0, 254),
        action: event.action.slice(0, 80),
        targetType: event.targetType ? event.targetType.slice(0, 40) : null,
        targetId: event.targetId ? event.targetId.slice(0, 80) : null,
        details: event.details,
        ipHash: event.ipHash ?? null,
      },
    });
  } catch (error) {
    console.error("Journal d'audit : écriture impossible :", error);
  }
}

/**
 * Enregistre une action d'un administrateur depuis une action serveur ou une route API :
 * l'empreinte de la connexion internet est lue dans la requête en cours.
 */
export async function recordAdminAction(
  admin: { id: string; email: string },
  event: {
    action: string;
    targetType?: string;
    targetId?: string;
    details?: Prisma.InputJsonObject;
  }
): Promise<void> {
  let ipHash: string | null = null;

  try {
    ipHash = hashClientIp((await headers()).get("x-forwarded-for"));
  } catch {
    ipHash = null;
  }

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    details: event.details,
    ipHash,
  });
}
