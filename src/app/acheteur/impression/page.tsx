// src/app/acheteur/impression/page.tsx
// Liste des commandes d'exemplaires imprimés de l'acheteur connecté.
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  BUYER_STATUS_LABELS,
  PRINT_ORDER_STATUS_STYLES,
} from "@/lib/print-shipping";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mes livres imprimés",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MesCommandesImprimeesPage() {
  const user = await requireUser("/acheteur/impression");

  const orders = await prisma.printOrder.findMany({
    where: { buyerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      number: true,
      productTitle: true,
      quantity: true,
      totalXof: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/acheteur" className="text-sm font-semibold text-brand-700 hover:underline">
            Retour à mon espace
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Mes livres imprimés</h1>
          <p className="mt-1 text-sm text-slate-600">
            Vos commandes d&apos;exemplaires imprimés. Vos achats numériques (PDF) restent dans « Mes commandes ».
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="card text-sm text-slate-600">
            Vous n&apos;avez pas encore commandé de livre imprimé. Les livres édités par TechLibrairie Édition
            proposant cette option affichent un bloc « Livre imprimé » sur leur page.
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.number} className="card flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{order.productTitle}</p>
                  <p className="text-xs text-slate-500">
                    {order.number} · {order.quantity} exemplaire{order.quantity > 1 ? "s" : ""} ·{" "}
                    {formatDate(order.createdAt)}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{formatPrice(order.totalXof, "XOF")}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${PRINT_ORDER_STATUS_STYLES[order.status]}`}
                  >
                    {BUYER_STATUS_LABELS[order.status]}
                  </span>
                  <Link
                    href={`/acheteur/impression/${order.number}`}
                    className="btn-secondary px-3 py-1 text-xs"
                  >
                    Ouvrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
