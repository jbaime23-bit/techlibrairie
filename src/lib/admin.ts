// src/lib/admin.ts
// Outils partagés de l'espace administrateur.
// Les pages, actions et routes d'administration exigent un compte administrateur
// ayant activé la double authentification (tant qu'elle est obligatoire).
// Seules la page de sécurité et ses routes acceptent un administrateur qui ne l'a pas encore activée.

import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { isTwoFactorRequired } from "@/lib/two-factor";

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

/** Pour les pages : exige un administrateur connecté, avec double authentification activée si obligatoire. */
export async function requireAdmin(callbackUrl: string) {
  const user = await requireRole(["ADMIN"], callbackUrl);

  if (isTwoFactorRequired() && !user.totpEnabledAt) {
    redirect("/admin/securite?obligatoire=1");
  }

  return user;
}

/** Pour la page de sécurité et la mise en page : exige un administrateur, sans exiger la double authentification. */
export async function requireAdminForSetup(callbackUrl: string) {
  return requireRole(["ADMIN"], callbackUrl);
}

/** Administrateur actif relu depuis la base (double authentification exigée si obligatoire), ou null. */
export async function getAdminOrNull() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  if (isTwoFactorRequired() && !user.totpEnabledAt) return null;
  return user;
}

/** Administrateur actif, même sans double authentification activée (routes de sécurité uniquement). */
export async function getAdminForSetupOrNull() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/** Pour les actions serveur : redirige si l'utilisateur n'est pas un administrateur autorisé. */
export async function assertAdminAction() {
  const admin = await getAdminOrNull();
  if (!admin) {
    redirect("/?erreur=acces-refuse");
  }
  return admin;
}
