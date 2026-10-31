// src/app/api/diagnostic/blob/route.ts
// OUTIL TEMPORAIRE (à supprimer ensuite) : teste réellement les jetons de stockage Vercel Blob.
// Réservé aux administrateurs. Aucune valeur secrète n'est affichée.

import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { getAdminOrNull } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SHAPE = /^vercel_blob_rw_([A-Za-z0-9]+)_[A-Za-z0-9]+$/;

type Access = "private" | "public";

interface TokenReport {
  variable: string;
  acces_teste: Access;
  presente: boolean;
  longueur?: number;
  forme_correcte?: boolean;
  debut_identifiant_du_store?: string | null;
  essai: "réussi" | "échec" | "non effectué";
  message_du_service?: string;
}

function shortMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "erreur inconnue";
  return message.replace(/\s+/g, " ").slice(0, 220);
}

async function testToken(variable: string, access: Access): Promise<TokenReport> {
  const raw = process.env[variable];

  if (!raw) {
    return { variable, acces_teste: access, presente: false, essai: "non effectué" };
  }

  const shape = SHAPE.exec(raw);
  const base = {
    variable,
    acces_teste: access,
    presente: true,
    longueur: raw.length,
    forme_correcte: Boolean(shape),
    debut_identifiant_du_store: shape ? shape[1].slice(0, 6).toLowerCase() : null,
  };

  if (/[^\x21-\x7E]/.test(raw)) {
    return {
      ...base,
      essai: "non effectué",
      message_du_service: "Le jeton contient un espace, un retour à la ligne ou un caractère invisible.",
    };
  }

  try {
    const blob = await put(`diagnostic/test-${Date.now()}.txt`, "test", {
      access,
      token: raw,
      addRandomSuffix: true,
      contentType: "text/plain",
    });
    await del(blob.url, { token: raw }).catch(() => undefined);
    return { ...base, essai: "réussi" };
  } catch (error) {
    return { ...base, essai: "échec", message_du_service: shortMessage(error) };
  }
}

function adviceFor(report: TokenReport, role: string): string | null {
  if (!report.presente) {
    return `${report.variable} (${role}) est ABSENTE pour cet environnement : créez-la ou reliez le store au projet.`;
  }

  if (report.essai === "réussi") return null;

  const message = (report.message_du_service ?? "").toLowerCase();

  if (message.includes("does not exist")) {
    return `${report.variable} (${role}) désigne un store qui n'existe pas : ancien jeton, store supprimé, ou variable d'un autre projet. Supprimez toutes les variables BLOB du projet (tous les environnements), puis reliez de nouveau le store au projet.`;
  }
  if (message.includes("access") || message.includes("private") || message.includes("public")) {
    return `${report.variable} (${role}) : le service refuse le mode d'accès « ${report.acces_teste} ». Soit le store n'est pas du bon type (privé pour les PDF, public pour les couvertures), soit la bibliothèque du site est trop ancienne pour les stores privés. Envoyez-moi ce message.`;
  }
  if (message.includes("token")) {
    return `${report.variable} (${role}) : le jeton est refusé par le service. Recréez-le en reliant le store au projet.`;
  }
  return `${report.variable} (${role}) : échec inattendu. Envoyez-moi le message du service.`;
}

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ erreur: "Accès réservé aux administrateurs." }, { status: 403 });
  }

  const [prive, public_] = await Promise.all([
    testToken("BLOB_READ_WRITE_TOKEN", "private"),
    testToken("BLOB_PUBLIC_READ_WRITE_TOKEN", "public"),
  ]);

  const conclusions = [adviceFor(prive, "PDF, store privé"), adviceFor(public_, "couvertures, store public")].filter(
    (message): message is string => message !== null
  );

  const bothPresent = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_PUBLIC_READ_WRITE_TOKEN
  );
  if (bothPresent && process.env.BLOB_READ_WRITE_TOKEN === process.env.BLOB_PUBLIC_READ_WRITE_TOKEN) {
    conclusions.push(
      "Les deux variables contiennent le même jeton : il faut deux stores différents (un privé pour les PDF, un public pour les couvertures)."
    );
  }

  const variablesDeStockage = Object.keys(process.env)
    .filter((name) => /BLOB|READ_WRITE|STORAGE/i.test(name))
    .sort();

  if (variablesDeStockage.length > 2) {
    conclusions.push(
      `Plusieurs variables de stockage existent (${variablesDeStockage.join(", ")}) : seules BLOB_READ_WRITE_TOKEN et BLOB_PUBLIC_READ_WRITE_TOKEN sont lues par le site. Supprimez les autres.`
    );
  }

  if (conclusions.length === 0) {
    conclusions.push(
      "Les deux stores répondent et acceptent l'écriture. L'envoi d'un PDF doit maintenant fonctionner : rechargez le formulaire et réessayez."
    );
  }

  return new NextResponse(
    JSON.stringify(
      {
        conclusions,
        environnement_vercel: process.env.VERCEL_ENV ?? "inconnu",
        adresse_du_deploiement: process.env.VERCEL_URL ?? "inconnue",
        noms_des_variables_de_stockage_presentes: variablesDeStockage,
        stockage_prive_pdf: prive,
        stockage_public_couvertures: public_,
      },
      null,
      2
    ),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    }
  );
    }
