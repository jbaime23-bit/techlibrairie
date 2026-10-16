// src/app/admin/administrateurs/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdminAction } from "@/lib/admin";
import { verifyAdminReauth } from "@/lib/admin-reauth";
import { disableTwoFactor } from "@/lib/two-factor";
import { recordAdminAction } from "@/lib/audit";
import { getEmailAppUrl, sendEmail } from "@/lib/email";

const BACK = "/admin/administrateurs";

function readText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Les mots de passe ne sont jamais "nettoyés" : les espaces en sont des caractères légitimes.
function readRaw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, 200) : "";
}

/** Nomme administrateur un compte existant (actif, adresse vérifiée). */
export async function promoteAdminAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const email = readText(formData, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`${BACK}?erreur=email`);
  }

  const reauth = await verifyAdminReauth(
    admin,
    readRaw(formData, "password"),
    readText(formData, "code", 20)
  );
  if (!reauth.ok) {
    redirect(`${BACK}?erreur=${reauth.reason}`);
  }

  const target = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      emailVerified: true,
    },
  });

  if (!target || !target.isActive) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  if (target.role === "ADMIN") {
    redirect(`${BACK}?erreur=deja-admin`);
  }

  if (!target.emailVerified) {
    redirect(`${BACK}?erreur=non-verifie`);
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role: "ADMIN" },
  });

  await recordAdminAction(admin, {
    action: "admin.promu",
    targetType: "utilisateur",
    targetId: target.id,
    details: { ancien_role: target.role },
  });

  const appUrl = getEmailAppUrl();
  await sendEmail({
    to: target.email,
    subject: "Vous êtes administrateur de TechLibrairie",
    content: {
      title: "Vous avez été nommé administrateur",
      paragraphs: [
        `Bonjour${target.name ? ` ${target.name}` : ""}, vous avez été nommé administrateur de TechLibrairie.`,
        "Déconnectez-vous puis reconnectez-vous pour activer ce rôle. Vous devrez alors activer la double authentification avant d'accéder à l'administration.",
      ],
      ...(appUrl ? { button: { label: "Me connecter", url: `${appUrl}/connexion` } } : {}),
      note: "Si vous n'attendiez pas ce message, contactez-nous.",
    },
  });

  revalidatePath(BACK);
  revalidatePath("/admin/utilisateurs");

  redirect(`${BACK}?message=promu`);
}

/** Retire le rôle d'administrateur (le compte redevient vendeur ou acheteur). */
export async function demoteAdminAction(formData: FormData): Promise<void> {
  const admin = await assertAdminAction();

  const userId = readText(formData, "userId", 40);
  if (!/^[a-z0-9]{1,40}$/i.test(userId)) {
    redirect(`${BACK}?erreur=introuvable`);
  }

  if (userId === admin.id) {
    redirect(`${BACK}?erreur=soi-meme`);
  }

  const reauth = await verifyAdminReauth(
    admin,
    readRaw(formData, "password"),
    readText(formData, "code", 20)
  );
  if (!reauth.ok) {
    redirect(`${BACK}?erreur=${reauth.reason}`);
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      sellerProfile: { select: { id: true } },
    },
  });

  if (!target || target.role !== "ADMIN") {
    redirect(`${BACK}?erreur=introuvable`);
  }

  const activeAdmins = await prisma.user.count({
    where: { role: "ADMIN", isActive: true },
  });
  if (activeAdmins <= 1) {
    redirect(`${BACK}?erreur=dernier`);
  }

  const newRole = target.sellerProfile ? "SELLER" : "BUYER";

  await disableTwoFactor(target.id);
  await prisma.user.update({
    where: { id: target.id },
    // passwordChangedAt coupe toute session encore ouverte de ce compte.
    data: { role: newRole, passwordChangedAt: new Date() },
  });

  await recordAdminAction(admin, {
    action: "admin.retrograde",
    targetType: "utilisateur",
    targetId: target.id,
    details: { nouveau_role: newRole },
  });

  await sendEmail({
    to: target.email,
    subject: "Votre rôle d'administrateur a été retiré",
    content: {
      title: "Rôle d'administrateur retiré",
      paragraphs: [
        `Bonjour${target.name ? ` ${target.name}` : ""}, votre rôle d'administrateur de TechLibrairie a été retiré. Votre compte reste actif, avec les droits d'un ${newRole === "SELLER" ? "vendeur" : "acheteur"}.`,
        "Vous avez été déconnecté de vos appareils : reconnectez-vous pour continuer.",
      ],
    },
  });

  revalidatePath(BACK);
  revalidatePath("/admin/utilisateurs");

  redirect(`${BACK}?message=retrograde`);
}
