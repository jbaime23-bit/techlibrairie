// src/app/api/diagnostic/blob/route.ts
// OUTIL TEMPORAIRE (à supprimer ensuite) : vérifie la FORME des jetons de stockage Vercel Blob.
// Réservé aux administrateurs. Aucune valeur secrète n'est jamais affichée : seulement des oui/non.

import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/admin";

export const dynamic = "force-dynamic";

const EXPECTED_PREFIX = "vercel_blob_rw_";
const EXPECTED_SHAPE = /^vercel_blob_rw_[A-Za-z0-9]+_[A-Za-z0-9]+$/;

function inspectToken(name: string) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return { variable: name, presente: false };
  }

  return {
    variable: name,
    presente: true,
    longueur: raw.length,
    commence_par_le_bon_debut: raw.startsWith(EXPECTED_PREFIX),
    contient_espace_ou_retour_a_la_ligne: /\s/.test(raw),
    contient_guillemets: /["'`]/.test(raw),
    contient_signe_egal: raw.includes("="),
    contient_caracteres_invalides_ou_invisibles: /[^\x21-\x7E]/.test(raw),
    forme_attendue: EXPECTED_SHAPE.test(raw),
  };
}

function adviceFor(info: ReturnType<typeof inspectToken>): string | null {
  if (!info.presente) {
    return `${info.variable} est absente dans Vercel.`;
  }
  if (info.contient_espace_ou_retour_a_la_ligne || info.contient_caracteres_invalides_ou_invisibles) {
    return `${info.variable} contient un espace, un retour à la ligne ou un caractère invisible : c'est la cause de l'erreur « Invalid value ». Recréez-la avec le bouton Copier, ou en reliant le store au projet.`;
  }
  if (info.contient_guillemets) {
    return `${info.variable} contient des guillemets : retirez-les, la valeur doit être collée telle quelle.`;
  }
  if (info.contient_signe_egal) {
    return `${info.variable} contient le signe « = » : le nom de la variable a probablement été collé dans la valeur. Ne collez que le jeton.`;
  }
  if (!info.commence_par_le_bon_debut) {
    return `${info.variable} ne commence pas par « ${EXPECTED_PREFIX} » : ce n'est pas un jeton de lecture et d'écriture de Vercel Blob.`;
  }
  if (!info.forme_attendue) {
    return `${info.variable} a une forme inhabituelle : recréez-la en reliant le store au projet.`;
  }
  return null;
}

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ erreur: "Accès réservé aux administrateurs." }, { status: 403 });
  }

  const prive = inspectToken("BLOB_READ_WRITE_TOKEN");
  const public_ = inspectToken("BLOB_PUBLIC_READ_WRITE_TOKEN");

  const conclusions = [adviceFor(prive), adviceFor(public_)].filter(
    (message): message is string => message !== null
  );

  const bothPresent = Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_PUBLIC_READ_WRITE_TOKEN);
  const identical =
    bothPresent && process.env.BLOB_READ_WRITE_TOKEN === process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;

  if (identical) {
    conclusions.push(
      "Les deux variables contiennent le même jeton : les PDF (privés) et les couvertures (publiques) doivent être dans deux stores différents."
    );
  }

  if (conclusions.length === 0) {
    conclusions.push(
      "La forme des deux jetons est correcte. Si l'erreur persiste, envoyez-moi la capture du message exact."
    );
  }

  return new NextResponse(
    JSON.stringify(
      {
        conclusions,
        stockage_prive_pdf: prive,
        stockage_public_couvertures: public_,
        les_deux_jetons_sont_identiques: identical,
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
