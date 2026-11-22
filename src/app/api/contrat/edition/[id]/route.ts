// src/app/api/contrat/edition/[id]/route.ts
// PDF du contrat d'édition à compte d'auteur d'un livre (id = identifiant de l'ouvrage).
// Disponible pour l'auteur DÈS QUE le forfait est réglé et validé par l'administration ; toujours pour un administrateur.

import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { getSellerContext } from "@/lib/seller";
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

  const project = await prisma.editionProject.findUnique({
    where: { productId: id },
    select: {
      sellerId: true,
      contractText: true,
      contractHash: true,
      contractAcceptedAt: true,
      signerName: true,
      signerEmail: true,
    },
  });

  if (!project) {
    return new Response("Introuvable", { status: 404 });
  }

  const admin = await getAdminOrNull();

  if (!admin) {
    const context = await getSellerContext();

    if (context.status !== "ok" || context.seller.id !== project.sellerId) {
      return new Response("Accès refusé", { status: 403 });
    }

    const fee = await prisma.publicationFee.findUnique({
      where: { productId: id },
      select: { status: true },
    });

    if (!fee || fee.status !== "VALIDATED") {
      return new Response(
        "Le contrat est disponible en PDF dès que le règlement du forfait est validé.",
        { status: 403 }
      );
    }
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { title: true },
  });

  const pdf = renderContractPdf({
    reference: `CE-${id.slice(-8).toUpperCase()}`,
    plainText: project.contractText,
    hash: project.contractHash,
    signature: {
      name: project.signerName,
      email: project.signerEmail,
      acceptedAt: project.contractAcceptedAt,
    },
  });

  const fileName = `contrat-edition-compte-auteur-${slugify(product?.title ?? "livre") || "livre"}.pdf`;

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
