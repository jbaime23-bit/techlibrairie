// src/app/api/facture/impression/[number]/route.ts
// Facture d'une commande d'exemplaires imprimés (number = numéro de commande, ex. LI-7K2M9QXD).
// Disponible pour l'acheteur dès que le paiement est validé ; toujours pour un administrateur.

import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { getLegalConfig } from "@/lib/legal-config";
import { PRINT_EARNED_STATUSES } from "@/lib/print-statuses";
import { PRINT_COUNTRIES } from "@/lib/print-shipping";
import { formatFrenchDate, renderDocumentPdf, type DocumentLine } from "@/lib/receipt-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
  AUTRE: "Autre moyen de paiement",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;

  if (!/^LI-[A-Z0-9]{8}$/.test(number)) {
    return new Response("Introuvable", { status: 404 });
  }

  const order = await prisma.printOrder.findUnique({ where: { number } });

  if (!order) {
    return new Response("Introuvable", { status: 404 });
  }

  const admin = await getAdminOrNull();

  if (!admin) {
    const user = await getCurrentUser();

    if (!user || user.id !== order.buyerId) {
      return new Response("Accès refusé", { status: 403 });
    }
  }

  if (!PRINT_EARNED_STATUSES.includes(order.status)) {
    return new Response("La facture est disponible dès que le paiement est validé.", { status: 403 });
  }

  const countryName =
    PRINT_COUNTRIES.find((country) => country.code === order.shipCountry)?.name ?? order.shipCountry;

  const lines: DocumentLine[] = [
    {
      label: `${order.productTitle} (livre imprimé à la demande${order.isAuthorCopy ? ", exemplaires d'auteur au prix de fabrication" : ""})`,
      quantity: order.quantity,
      unitXof: order.unitPriceXof,
      totalXof: order.unitPriceXof * order.quantity,
    },
  ];

  if (order.shippingXof > 0) {
    lines.push({
      label: "Livraison",
      quantity: 1,
      unitXof: order.shippingXof,
      totalXof: order.shippingXof,
    });
  }

  const clientLines = [order.shipStreet1];
  if (order.shipStreet2) clientLines.push(order.shipStreet2);
  clientLines.push(`${order.shipPostcode} ${order.shipCity}${order.shipState ? `, ${order.shipState}` : ""}`);
  clientLines.push(countryName);

  const pdf = renderDocumentPdf({
    title: "Facture",
    number: `F-${order.number}`,
    issuedOn: formatFrenchDate(order.paidAt ?? new Date()),
    issuer: getLegalConfig(),
    client: { name: order.shipName, lines: clientLines },
    lines,
    totalXof: order.totalXof,
    payment: {
      label: order.paymentMethod ? (METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod) : "Mobile Money",
      reference: order.paymentReference,
      paidOn: order.paidAt ? formatFrenchDate(order.paidAt) : null,
    },
    notes: [
      `Commande ${order.number}. Chaque exemplaire est fabriqué à la commande. Prix sans taxe supplémentaire ; les droits de douane et taxes locales éventuels du pays de livraison restent à la charge de l'acheteur.`,
      "Montants exprimés en francs CFA (FCFA). Droit de rétractation et garanties : voir les conditions générales du site.",
    ],
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-${order.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
