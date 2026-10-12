// src/lib/account-emails.ts
// Emails liés au compte : réinitialisation du mot de passe, vérification de l'adresse
// et alerte de sécurité après un changement de mot de passe.

import {
  getEmailAppUrl,
  isEmailConfigured,
  sendEmail,
  type SendResult,
} from "@/lib/email";

const UNAVAILABLE: SendResult = {
  ok: false,
  error: "Envoi d'emails indisponible (configuration manquante).",
};

/** Envoie le lien de réinitialisation du mot de passe (valable 1 heure). */
export async function sendPasswordResetEmail(params: {
  email: string;
  name: string | null;
  token: string;
}): Promise<SendResult> {
  const appUrl = getEmailAppUrl();
  if (!appUrl || !isEmailConfigured()) return UNAVAILABLE;

  return sendEmail({
    to: params.email,
    subject: "Réinitialisation de votre mot de passe TechLibrairie",
    content: {
      title: "Réinitialisation de votre mot de passe",
      paragraphs: [
        `Bonjour${params.name ? ` ${params.name}` : ""}, vous avez demandé à réinitialiser votre mot de passe TechLibrairie.`,
        "Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.",
      ],
      button: {
        label: "Choisir un nouveau mot de passe",
        url: `${appUrl}/reinitialiser-mot-de-passe?token=${params.token}`,
      },
      note: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe actuel reste inchangé.",
    },
  });
}

/** Envoie le lien de vérification de l'adresse email (valable 24 heures). */
export async function sendVerificationEmail(params: {
  email: string;
  name: string | null;
  token: string;
}): Promise<SendResult> {
  const appUrl = getEmailAppUrl();
  if (!appUrl || !isEmailConfigured()) return UNAVAILABLE;

  return sendEmail({
    to: params.email,
    subject: "Vérifiez votre adresse email TechLibrairie",
    content: {
      title: "Vérifiez votre adresse email",
      paragraphs: [
        `Bonjour${params.name ? ` ${params.name}` : ""}, bienvenue sur TechLibrairie !`,
        "Confirmez votre adresse email pour recevoir vos confirmations d'achat et pouvoir récupérer votre compte en cas d'oubli de mot de passe. Ce lien est valable 24 heures.",
      ],
      button: {
        label: "Vérifier mon adresse email",
        url: `${appUrl}/verifier-email?token=${params.token}`,
      },
      note: "Si vous n'avez pas créé de compte sur TechLibrairie, ignorez cet email.",
    },
  });
}

/** Alerte de sécurité : le mot de passe vient d'être modifié. */
export async function sendPasswordChangedEmail(params: {
  email: string;
  name: string | null;
}): Promise<SendResult> {
  const appUrl = getEmailAppUrl();
  if (!appUrl || !isEmailConfigured()) return UNAVAILABLE;

  return sendEmail({
    to: params.email,
    subject: "Votre mot de passe TechLibrairie a été modifié",
    content: {
      title: "Votre mot de passe a été modifié",
      paragraphs: [
        `Bonjour${params.name ? ` ${params.name}` : ""}, le mot de passe de votre compte TechLibrairie vient d'être modifié. Vous avez été déconnecté de tous vos appareils.`,
        "Si vous êtes à l'origine de ce changement, vous n'avez rien à faire.",
      ],
      button: {
        label: "Ce n'est pas moi : réinitialiser mon mot de passe",
        url: `${appUrl}/mot-de-passe-oublie`,
      },
      note: "Si vous n'êtes pas à l'origine de ce changement, réinitialisez immédiatement votre mot de passe puis contactez le support.",
    },
  });
}
