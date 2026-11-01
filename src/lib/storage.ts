// src/lib/storage-check.ts
// Test réel des deux stockages Vercel Blob (écriture puis suppression d'un petit fichier).
// Pour chaque jeton, les deux modes (public et privé) sont essayés afin d'identifier le type du store.
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
    const actual = works.map(accessLabel).join(" et ");
    return {
      ...base,
      ok: false,
      kind: "wrong-type",
      message: `Ce jeton est valable, mais il appartient à un store ${actual}, alors que « ${role} » exige un store ${accessLabel(access)}.`,
    };
  }

  if (dirty) {
    return {
      ...base,
      ok: false,
      kind: "dirty",
      message:
        "Le jeton est valable, mais la valeur enregistrée contient des espaces, des guillemets ou des caractères invisibles : le site ne peut pas l'utiliser telle quelle.",
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
      return null;
    case "absent":
      return `${result.variable} (${result.role}) est absente : reliez un store au projet (Storage, Connect Project) puis redéployez.`;
    case "dirty":
      return `${result.variable} (${result.role}) : supprimez cette variable dans Vercel puis reliez de nouveau le store avec Connect Project, au lieu de coller le jeton à la main.`;
    case "wrong-type":
      return `${result.variable} (${result.role}) : le store relié n'est pas du bon type. Créez un store ${accessLabel(result.access)} neuf et reliez-le à la place.`;
    case "invalid":
      return `${result.variable} (${result.role}) : jeton invalide (ancien, incomplet, ou d'un autre projet). Supprimez cette variable, supprimez les anciens stores inutiles, créez un store neuf ${accessLabel(result.access)} et reliez-le avec Connect Project.`;
  }
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

  return {
    results,
    variableNames,
    environment: process.env.VERCEL_ENV ?? "inconnu",
    hints,
  };
    }
