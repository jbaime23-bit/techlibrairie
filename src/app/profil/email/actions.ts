"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
// Importez ici votre instance de base de données (ex: prisma) si nécessaire
// import { prisma } from "@/lib/db"; 

export async function requestEmailChangeAction(formData: FormData) {
  // 1. Vérification que l'envoi d'emails est bien configuré
  if (!isEmailConfigured()) {
    redirect("/profil/email?erreur=indisponible");
  }

  // 2. Sécurisation de l'accès : récupération de l'utilisateur connecté
  const user = await requireUser("/profil/email");

  // 3. Récupération et nettoyage des données du formulaire
  const newEmail = formData.get("newEmail")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const code = formData.get("code")?.toString().trim();

  // Validation basique du format de l'email
  if (!newEmail || !newEmail.includes("@")) {
    redirect("/profil/email?erreur=email");
  }

  // L'adresse ne doit pas être identique à l'actuelle
  if (newEmail === user.email.toLowerCase()) {
    redirect("/profil/email?erreur=identique");
  }

  try {
    // 4. VERIFICATION DU MOT DE PASSE
    // /!\ REMPLACEZ cette ligne par votre propre logique de vérification (ex: bcrypt ou argon2)
    const isPasswordCorrect = true; // ex: await verifyPassword(password, user.passwordHash);
    if (!isPasswordCorrect) {
      redirect("/profil/email?erreur=mot-de-passe");
    }

    // 5. VERIFICATION DU CODE DE DOUBLE AUTHENTIFICATION (Si ADMIN et TOTP activé)
    const needsCode = user.role === "ADMIN" && Boolean(user.totpEnabledAt);
    if (needsCode) {
      // /!\ REMPLACEZ cette ligne par votre propre vérification TOTP (ex: otplib)
      const isCodeCorrect = code && code.length === 6; // ex: await verifyTotp(code, user.totpSecret);
      if (!isCodeCorrect) {
        redirect("/profil/email?erreur=code");
      }
    }

    // 6. VERIFICATION DE LA DISPONIBILITE DE L'EMAIL (En base de données)
    // /!\ Décommentez et adaptez selon votre ORM / Base de données
    /*
    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) {
      redirect("/profil/email?erreur=utilisee");
    }
    */

    // 7. GENERATION DU JETON & ENVOI DE L'EMAIL
    // Ajoutez ici la création de votre lien sécurisé et l'envoi du mail de confirmation.
    // Si l'envoi échoue, utilisez : redirect("/profil/email?erreur=envoi");

  } catch (error) {
    // Si l'erreur est une redirection Next.js volontaire, on la laisse passer
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    // Pour toute autre erreur imprévue (panne bdd, bug réseau...)
    redirect("/profil/email?erreur=technique");
  }

  // 8. REDIRECTION DE SUCCÈS
  // Si tout s'est bien passé, on redirige avec le message de confirmation
  redirect(`/profil/email?message=envoye&destinataire=${encodeURIComponent(newEmail)}`);
}export async function confirmEmailChangeAction(token: string) {
  // Ajoutez ici votre logique pour valider le jeton (token) en base de données
  // et mettre à jour l'adresse email de l'utilisateur.
}
