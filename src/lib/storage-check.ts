// src/lib/storage-check.ts
// Test réel du stockage Vercel Blob (écriture puis suppression d'un petit fichier)
// et simulation de la demande de jeton d'envoi faite par le formulaire.
// Aucune valeur secrète n'est jamais renvoyée : seulement des états et des messages.

import { del, put } from "@vercel/blob";

export type StorageAccess = "private" | "public";

type Kind = "ok" | "absent" | "dirty" | "wrong-type" | "invalid";

export interface StorageTestResult {
  variable: string;
  role: string;
  access: StorageAccess;
  present: boolean;
  shapeOk: boolean;
  ok: boolean;
  kind: Kind;
  message: string;
}

export interface StorageTestReport {
  results: StorageTestResult[];
  variableNames: string[];
  environment: string;
  hints: string[];
}

export interface UploadSimulation {
  ok: boolean;
  status: number | null;
  message: string;
  hint: string | null;
}

const SHAPE = /^vercel_blob_rw_[A-Za-z0-9]+_[A-Za-z0-9]+$/;

function shortMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "erreur inconnue";
  return message.replace(/\s+/g, " ").slice(0, 160);
}

function accessLabel(access: StorageAccess): string {
  return access === "private" ? "privé" : "public";
}

async function tryPut(
  token: string,
  access: StorageAccess
): Promise<{ ok: boolean; message: string }> {
  try {
    const blob = await put(`diagnostic/test-${Date.now()}.txt`, "test", {
      access: access as "public",
      token,
      addRandomSuffix: true,
      contentType: "text/plain",
    });
    await del(blob.url, { token }).catch(() => undefined);
    return { ok: true, message: "réussi" };
  } catch (error) {
    return { ok: false, message: shortMessage(error) };
  }
}

async function testPrivateStore(): Promise<StorageTestResult> {
  const variable = "BLOB_READ_WRITE_TOKEN";
  const role = "PDF et couvertures, store privé";
  const access: StorageAccess = "private";
  const raw = process.env[variable];

  if (!raw) {
    return {
      variable,
      role,
      access,
      present: false,
      shapeOk: false,
      ok: false,
      kind: "absent",
      message: "Variable absente pour cet environnement.",
    };
  }

  const shapeOk = SHAPE.test(raw);
  const cleaned = raw.replace(/[^\x21-\x7E]/g, "").replace(/["'`]/g, "");
  const dirty = cleaned !== raw;

  const [publicTry, privateTry] = await Promise.all([
    tryPut(cleaned, "public"),
    tryPut(cleaned, "private"),
  ]);

  const works: StorageAccess[] = [];
  if (publicTry.ok) works.push("public");
  if (privateTry.ok) works.push("private");

  const base = { variable, role, access, present: true, shapeOk };

  if (works.length === 0) {
    return {
      ...base,
      ok: false,
      kind: "invalid",
      message: `Aucun accès ne fonctionne avec ce jeton${dirty ? " (même nettoyé)" : ""}. Public : ${publicTry.message}. Privé : ${privateTry.message}.`,
    };
  }

  if (!works.includes(access)) {
    return {
      ...base,
      ok: false,
      kind: "wrong-type",
      message: `Ce jeton est valable, mais il appartient à un store ${works.map(accessLabel).join(" et ")}, alors que le site exige un store privé.`,
    };
  }

  if (dirty) {
    return {
      ...base,
      ok: false,
      kind: "dirty",
      message:
        "Le jeton est valable, mais la valeur enregistrée contient des espaces, des guillemets ou des caractères invisibles. Le site la nettoie désormais automatiquement.",
    };
  }

  return {
    ...base,
    ok: true,
    kind: "ok",
    message: "Écriture et suppression réussies.",
  };
}

function hintFor(result: StorageTestResult): string | null {
  switch (result.kind) {
    case "ok":
    case "dirty":
      return null;
    case "absent":
      return "BLOB_READ_WRITE_TOKEN est absente : reliez un store privé au projet (Storage, puis Connect Project, préfixe par défaut) et redéployez.";
    case "wrong-type":
      return "Le store relié au projet est un store PUBLIC : supprimez-le, créez un store PRIVÉ neuf et reliez-le au projet avec le préfixe par défaut.";
    case "invalid":
      return "Jeton invalide (ancien, incomplet, ou d'un autre projet) : supprimez les variables BLOB_ du projet et les anciens stores, créez UN store privé neuf et reliez-le avec Connect Project.";
  }
}

export async function testBlobTokens(): Promise<StorageTestReport> {
  const result = await testPrivateStore();
  const hints: string[] = [];

  const hint = hintFor(result);
  if (hint) hints.push(hint);

  if (process.env.BLOB_PUBLIC_READ_WRITE_TOKEN) {
    hints.push(
      "BLOB_PUBLIC_READ_WRITE_TOKEN n'est plus utilisée : le site n'a plus besoin que d'un seul store privé. Vous pouvez supprimer cette variable et le store public."
    );
  }

  const variableNames = Object.keys(process.env)
    .filter((name) => /BLOB|READ_WRITE/i.test(name))
    .sort();

  return {
    results: [result],
    variableNames,
    environment: process.env.VERCEL_ENV ?? "inconnu",
    hints,
  };
}

function simulationHint(status: number | null, message: string): string | null {
  const text = message.toLowerCase();

  if (status === null) {
    return "Le test n'a pas pu joindre la route : vérifiez NEXT_PUBLIC_APP_URL (elle doit valoir https://techlibrairie.com).";
  }
  if (text.includes("accès refusé") || text.includes("compte vendeur")) {
    return "Le serveur ne reconnaît pas votre profil vendeur actif : activez-le sur /vendeur/activer.";
  }
  if (text.includes("chemin")) {
    return "Le chemin du fichier est refusé : envoyez-moi ce message.";
  }
  if (text.includes("token")) {
    return "Le serveur ne trouve pas un jeton valable pour le store privé : vérifiez BLOB_READ_WRITE_TOKEN (store privé relié au projet, puis redéploiement).";
  }
  return "Envoyez-moi ce message tel quel.";
}

/**
 * Rejoue la demande de jeton d'envoi que fait le formulaire, avec la session de l'administrateur,
 * et renvoie la réponse du serveur (le jeton lui-même n'est jamais affiché).
 */
export async function simulateUploadRoute(params: {
  origin: string;
  cookie: string;
  sellerId: string;
}): Promise<UploadSimulation> {
  const url = `${params.origin}/api/upload/pdf`;

  const event = {
    type: "blob.generate-client-token",
    payload: {
      pathname: `pdfs/${params.sellerId}/verification.pdf`,
      callbackUrl: url,
      clientPayload: null,
      multipart: false,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: params.cookie },
      body: JSON.stringify(event),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const text = await response.text();

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        message: "Le serveur a généré un jeton d'envoi : le formulaire peut envoyer un PDF.",
        hint: null,
      };
    }

    let message = text.replace(/\s+/g, " ").slice(0, 220);
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === "string") message = parsed.error;
    } catch {
      // Réponse non JSON : le texte brut est conservé.
    }

    return {
      ok: false,
      status: response.status,
      message,
      hint: simulationHint(response.status, message),
    };
  } catch (error) {
    const message = shortMessage(error);
    return { ok: false, status: null, message, hint: simulationHint(null, message) };
  }
      }
