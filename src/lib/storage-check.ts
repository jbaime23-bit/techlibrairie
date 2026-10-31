// src/lib/storage-check.ts
// Test réel des deux stockages Vercel Blob (écriture puis suppression d'un petit fichier).
// Aucune valeur secrète n'est jamais renvoyée : seulement des états et des messages.

import { del, put } from "@vercel/blob";

export type StorageAccess = "private" | "public";

export interface StorageTestResult {
  variable: string;
  role: string;
  access: StorageAccess;
  present: boolean;
  shapeOk: boolean;
  ok: boolean;
  message: string;
}

export interface StorageTestReport {
  results: StorageTestResult[];
  variableNames: string[];
  environment: string;
  hints: string[];
}

const SHAPE = /^vercel_blob_rw_[A-Za-z0-9]+_[A-Za-z0-9]+$/;

function shortMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "erreur inconnue";
  return message.replace(/\s+/g, " ").slice(0, 220);
}

async function testOne(
  variable: string,
  role: string,
  access: StorageAccess
): Promise<StorageTestResult> {
  const raw = process.env[variable];

  if (!raw) {
    return {
      variable,
      role,
      access,
      present: false,
      shapeOk: false,
      ok: false,
      message: "Variable absente pour cet environnement.",
    };
  }

  const shapeOk = SHAPE.test(raw);

  if (/[^\x21-\x7E]/.test(raw)) {
    return {
      variable,
      role,
      access,
      present: true,
      shapeOk,
      ok: false,
      message:
        "Le jeton contient un espace, un retour à la ligne ou un caractère invisible (cause de l'erreur « Invalid value »).",
    };
  }

  try {
    const blob = await put(`diagnostic/test-${Date.now()}.txt`, "test", {
      access: access as "public",
      token: raw,
      addRandomSuffix: true,
      contentType: "text/plain",
    });
    await del(blob.url, { token: raw }).catch(() => undefined);

    return {
      variable,
      role,
      access,
      present: true,
      shapeOk,
      ok: true,
      message: "Écriture et suppression réussies.",
    };
  } catch (error) {
    return {
      variable,
      role,
      access,
      present: true,
      shapeOk,
      ok: false,
      message: shortMessage(error),
    };
  }
}

function hintFor(result: StorageTestResult): string | null {
  if (result.ok) return null;

  if (!result.present) {
    return `${result.variable} (${result.role}) est absente : reliez le store au projet (Storage, Connect Project), puis redéployez.`;
  }

  const message = result.message.toLowerCase();

  if (message.includes("does not exist")) {
    return `${result.variable} (${result.role}) désigne un store qui n'existe pas : ancien jeton, store supprimé, jeton incomplet ou variable d'un autre projet. Supprimez toutes les variables BLOB dans tous les environnements, supprimez les anciens stores, créez un store neuf et reliez-le avec Connect Project.`;
  }
  if (message.includes("access") || message.includes("private") || message.includes("public")) {
    return `${result.variable} (${result.role}) : accès « ${result.access} » refusé. Le store n'est probablement pas du bon type (privé pour les PDF, public pour les couvertures). Envoyez-moi ce message.`;
  }
  if (message.includes("token") || message.includes("invisible")) {
    return `${result.variable} (${result.role}) : jeton refusé. Recréez-le en reliant le store au projet, sans le copier à la main.`;
  }
  return `${result.variable} (${result.role}) : échec inattendu. Envoyez-moi le message affiché.`;
}

export async function testBlobTokens(): Promise<StorageTestReport> {
  const results = await Promise.all([
    testOne("BLOB_READ_WRITE_TOKEN", "PDF, store privé", "private"),
    testOne("BLOB_PUBLIC_READ_WRITE_TOKEN", "couvertures, store public", "public"),
  ]);

  const hints = results
    .map((result) => hintFor(result))
    .filter((hint): hint is string => hint !== null);

  const privateToken = process.env.BLOB_READ_WRITE_TOKEN;
  const publicToken = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;
  if (privateToken && publicToken && privateToken === publicToken) {
    hints.push(
      "Les deux variables contiennent le même jeton : il faut deux stores différents (privé pour les PDF, public pour les couvertures)."
    );
  }

  const variableNames = Object.keys(process.env)
    .filter((name) => /BLOB|READ_WRITE/i.test(name))
    .sort();

  if (variableNames.length > 2) {
    hints.push(
      `Plusieurs variables de stockage existent (${variableNames.join(", ")}) : seules BLOB_READ_WRITE_TOKEN et BLOB_PUBLIC_READ_WRITE_TOKEN sont lues par le site. Supprimez les autres.`
    );
  }

  return {
    results,
    variableNames,
    environment: process.env.VERCEL_ENV ?? "inconnu",
    hints,
  };
  }
