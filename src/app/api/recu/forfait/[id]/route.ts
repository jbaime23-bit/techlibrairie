// src/app/api/recu/forfait/[id]/route.ts
// Reçu de paiement du forfait d'édition à compte d'auteur (id = identifiant du livre).
// Disponible pour l'auteur dès que le règlement est validé par l'administration ; toujours pour un administrateur.

import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { getSellerContext } from "@/lib/seller";
import { getLegalConfig } from "@/lib/legal-config";
import { formatFrenchDate, renderDocumentPdf } from "@/lib/receipt-pdf";
import { slugify } from "@/lib/assembly/text-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    return new Response("Introuvable", { status: 404 });
  }

  const [fee, product, project] = await Promise.all([
    prisma.publicationFee.findUnique({
      where: { productId: id },
      select: {
        amountXof: true,
        status: true,
        method: true,
        paymentReference: true,
        validatedAt: true,
        submittedAt: true,
      },
    }),
    prisma.product.findUnique({
      where: { id },
      select: { title: true, sellerId: true, seller: { select: { displayName: true } } },
    }),
    prisma.editionProject.findUnique({
      where: { productId: id },
      select: { signerName: true, signerEmail: true },
    }),
  ]);

  if (!fee || !product) {
    return new Response("Introuvable", { status: 404 });
  }

  const admin = await getAdminOrNull();

  if (!admin) {
    const context = await getSellerContext();

    if (context.status !== "ok" || context.seller.id !== product.sellerId) {
      return new Response("Accès refusé", { status: 403 });
    }
  }

  if (fee.status !== "VALIDATED") {
    return new Response("Le reçu est disponible dès que le règlement du forfait est validé.", {
      status: 403,
    });
  }

  const paidOn = fee.validatedAt ?? fee.submittedAt ?? new Date();

  const pdf = renderDocumentPdf({
    title: "Reçu de paiement",
    number: `RF-${id.slice(-8).toUpperCase()}`,
    issuedOn: formatFrenchDate(new Date()),
    issuer: getLegalConfig(),
    client: {
      name: project?.signerName ?? product.seller.displayName,
      lines: project?.signerEmail ? [project.signerEmail] : [],
    },
    lines: [
      {
        label: `Forfait d'édition à compte d'auteur : « ${product.title} »`,
        quantity: 1,
        unitXof: fee.amountXof,
        totalXof: fee.amountXof,
      },
    ],
    totalXof: fee.amountXof,
    payment: {
      label: fee.method ? (METHOD_LABELS[fee.method] ?? fee.method) : "Mobile Money",
      reference: fee.paymentReference,
      paidOn: formatFrenchDate(paidOn),
    },
    notes: [
      "Forfait unique par livre, toutes taxes comprises, couvrant le contrôle de conformité, la mise en page et la publication, selon le contrat d'édition à compte d'auteur accepté par l'auteur.",
      "Montants exprimés en francs CFA (FCFA). Ce reçu atteste du règlement du forfait d'édition ; il ne constitue pas une garantie de publication, qui reste soumise à l'approbation du bon à tirer et à la validation de la mise en ligne.",
    ],
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recu-forfait-${slugify(product.title) || "livre"}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
