// src/app/api/contrat/editeur/[id]/route.ts
// PDF du contrat d'édition à compte d'éditeur (id = identifiant du manuscrit retenu).
// Disponible pour l'auteur dès que son manuscrit est retenu (projet non signé, puis contrat signé) ; toujours
// pour un administrateur.

import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { renderContractPdf } from "@/lib/contract-pdf";
import { slugify } from "@/lib/assembly/text-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    return new Response("Introuvable", { status: 404 });
  }

  const contract = await prisma.publisherContract.findUnique({
    where: { submissionId: id },
  });

  if (!contract) {
    return new Response("Introuvable", { status: 404 });
  }

  const admin = await getAdminOrNull();

  if (!admin) {
    const user = await getCurrentUser();

    if (!user || user.id !== contract.userId) {
      return new Response("Accès refusé", { status: 403 });
    }
  }

  const signed = contract.acceptedAt !== null && contract.signerName !== null && contract.signerEmail !== null;

  const pdf = renderContractPdf({
    reference: `CD-${id.slice(-8).toUpperCase()}`,
    plainText: contract.text,
    hash: contract.hash,
    signature: signed
      ? {
          name: contract.signerName ?? "",
          email: contract.signerEmail ?? "",
          acceptedAt: contract.acceptedAt ?? contract.offeredAt,
        }
      : null,
  });

  const fileName = `contrat-edition-compte-editeur-${slugify(contract.workTitle) || "livre"}${signed ? "" : "-projet"}.pdf`;

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
