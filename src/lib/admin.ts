// src/lib/admin.ts
// Outils partagés de l'espace administrateur.

import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/auth";

export const ADMIN_PAGE_SIZE = 20;

type SearchValue = string | string[] | undefined;

/** Première valeur d'un paramètre d'URL. */
export function firstParam(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Numéro de page demandé (1 par défaut). */
export function parsePage(value: SearchValue): number {
  const parsed = Number.parseInt(firstParam(value) ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Pour les pages : exige un administrateur connecté. */
export async function requireAdmin(callbackUrl: string) {
  return requireRole(["ADMIN"], callbackUrl);
}

/** Administrateur actif relu depuis la base, ou null. */
export async function getAdminOrNull() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/** Pour les actions serveur : redirige si l'utilisateur n'est pas administrateur. */
export async function assertAdminAction() {
  const admin = await getAdminOrNull();
  if (!admin) {
    redirect("/?erreur=acces-refuse");
  }
  return admin;
}
