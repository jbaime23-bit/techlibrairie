// src/lib/assembly/send-to-site.ts
// Envoi, depuis le navigateur, des PDF générés par le module d'assemblage vers le site :
// - l'intérieur comme épreuve (bon à tirer) d'une édition à compte d'auteur ;
// - l'intérieur et la couverture comme fichiers d'impression du livre.
// Les fichiers partent directement vers le stockage privé, puis sont enregistrés (administrateurs seulement).

import { upload } from "@vercel/blob/client";
import { MAX_PDF_SIZE_BYTES } from "@/lib/product-validation";

export interface SendResult {
  ok: boolean;
  message: string;
}

type Progress = (percent: number) => void;

function tooLarge(blob: Blob): SendResult | null {
  if (blob.size > MAX_PDF_SIZE_BYTES) {
    return { ok: false, message: "Le PDF dépasse 50 Mo : il ne peut pas être envoyé au site." };
  }
  return null;
}

function failure(error: unknown): SendResult {
  return {
    ok: false,
    message:
      error instanceof Error
        ? `Envoi impossible : ${error.message}`
        : "Envoi impossible. Vérifiez votre connexion et réessayez.",
  };
}

/** Dépose le PDF comme nouvelle épreuve (bon à tirer) du livre : l'auteur est prévenu par email. */
export async function sendProofToSite(
  productId: string,
  nextVersion: number,
  blob: Blob,
  fileName: string,
  onProgress?: Progress
): Promise<SendResult> {
  const large = tooLarge(blob);
  if (large) return large;

  try {
    const file = new File([blob], fileName, { type: "application/pdf" });

    const uploaded = await upload(`edition/${productId}/epreuve-v${nextVersion}.pdf`, file, {
      access: "private",
      handleUploadUrl: "/api/admin/edition/upload",
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    });

    const response = await fetch(`/api/edition/${productId}/epreuve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfKey: uploaded.pathname, fileName }),
    });

    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      version?: number;
    } | null;

    if (!response.ok || !result?.ok) {
      return { ok: false, message: result?.error ?? "L'enregistrement de l'épreuve a échoué. Réessayez." };
    }

    return {
      ok: true,
      message: `Épreuve version ${result.version ?? nextVersion} enregistrée : l'auteur est prévenu par email.`,
    };
  } catch (error) {
    return failure(error);
  }
}

/** Enregistre le PDF comme fichier d'impression (intérieur ou couverture) du livre. */
export async function sendPrintFileToSite(
  productId: string,
  role: "interieur" | "couverture",
  blob: Blob,
  fileName: string,
  onProgress?: Progress
): Promise<SendResult> {
  const large = tooLarge(blob);
  if (large) return large;

  try {
    const file = new File([blob], fileName, { type: "application/pdf" });

    const uploaded = await upload(`lulu/${productId}/${role}.pdf`, file, {
      access: "private",
      handleUploadUrl: "/api/admin/impression/upload",
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    });

    const response = await fetch(`/api/admin/impression/${productId}/fichier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, pdfKey: uploaded.pathname, fileName }),
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!response.ok || !result?.ok) {
      return { ok: false, message: result?.error ?? "L'enregistrement du fichier d'impression a échoué." };
    }

    return {
      ok: true,
      message: role === "interieur" ? "PDF intérieur enregistré." : "PDF de couverture enregistré.",
    };
  } catch (error) {
    return failure(error);
  }
}
