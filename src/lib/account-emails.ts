// src/lib/account-emails.ts
// Emails liés au compte : réinitialisation du mot de passe, vérification de l'adresse,
// alerte après un changement de mot de passe, et changement d'adresse email.

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

/** Masque une adresse pour l'afficher sans la révéler, ex. jean.dupont@exemple.com devient j***@exemple.com. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.charAt(0)}***@${domain}`;
}

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

/** Lien de confirmation envoyé à la NOUVELLE adresse (valable 1 heure). */
export async function sendEmailChangeConfirmationEmail(params: {
  newEmail: string;
  name: string | null;
  token: string;
}): Promise<SendResult> {
  const appUrl = getEmailAppUrl();
  if (!appUrl || !isEmailConfigured()) return UNAVAILABLE;

  return sendEmail({
    to: params.newEmail,
    subject: "Confirmez votre nouvelle adresse email TechLibrairie",
    content: {
      title: "Confirmez votre nouvelle adresse email",
      paragraphs: [
        `Bonjour${params.name ? ` ${params.name}` : ""}, une demande de changement d'adresse email a été faite pour un compte TechLibrairie : cette adresse deviendrait l'adresse de connexion du compte.`,
        "Pour confirmer, cliquez sur le bouton ci-dessous (vous devrez être connecté à votre compte). Ce lien est valable 1 heure et ne peut servir qu'une seule fois.",
      ],
      button: {
        label: "Confirmer ma nouvelle adresse",
        url: `${appUrl}/profil/email/confirmer?token=${params.token}`,
      },
      note: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : rien ne sera modifié.",
    },
  });
}

/** Alerte envoyée à l'ANCIENNE adresse quand un changement est demandé. */
export async function sendEmailChangeNoticeEmail(params: {
  oldEmail: string;
  name: string | null;
  newEmail: string;
}): Promise<SendResult> {
  const appUrl = getEmailAppUrl();
  if (!appUrl || !isEmailConfigured()) return UNAVAILABLE;

  return sendEmail({
    to: params.oldEmail,
    subject: "Demande de changement d'adresse email sur votre compte TechLibrairie",
    content: {
      title: "Changement d'adresse email demandé",
      paragraphs: [
        `Bonjour${params.name ? ` ${params.name}` : ""}, quelqu'un a demandé de remplacer l'adresse email de votre compte TechLibrairie par ${maskEmail(params.newEmail)}.`,
        "Le changement n'a lieu que si le lien envoyé à cette nouvelle adresse est confirmé dans l'heure. Si c'est vous, vous n'avez rien à faire.",
      ],
      button: {
        label: "Ce n'est pas moi : réinitialiser mon mot de passe",
        url: `${appUrl}/mot-de-passe-oublie`,
      },
      note: "Si vous n'êtes pas à l'origine de cette demande, changez immédiatement votre mot de passe et contactez le support.",
    },
  });
}

/** Confirmation envoyée à l'ANCIENNE adresse après le changement. */
export async function sendEmailChangedEmail(params: {
  oldEmail: string;
  name: string | null;
  newEmail: string;
}): Promise<SendResult> {
  if (!isEmailConfigured()) return UNAVAILABLE;

  return sendEmail({
    to: params.oldEmail,
    subject: "L'adresse email de votre compte TechLibrairie a été modifiée",
    content: {
      title: "Adresse email modifiée",
      paragraphs: [
        `Bonjour${params.name ? ` ${params.name}` : ""}, l'adresse email de votre compte TechLibrairie est désormais ${maskEmail(params.newEmail)}. Vous ne recevrez plus de messages à cette ancienne adresse.`,
      ],
      note: "Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support TechLibrairie.",
    },
  });
      }
