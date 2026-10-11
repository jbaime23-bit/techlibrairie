// src/app/paiement/retour/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { syncOrderPayments } from "@/lib/orders";
import { AutoRefresh } from "@/components/paiement/auto-refresh";
import { ClearCart } from "@/components/paiement/clear-cart";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Confirmation de commande",
};

export const dynamic = "force-dynamic";

function loadOrder(orderId: string, buyerId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, buyerId },
    include: {
      items: {
        include: {
          downloads: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
}

export default async function RetourPaiementPage({
  searchParams,
}: {
  searchParams: { commande?: string | string[] };
}) {
  const rawOrderId = Array.isArray(searchParams.commande)
    ? searchParams.commande[0]
    : searchParams.commande;

  if (!rawOrderId || !/^[a-z0-9]{1,40}$/i.test(rawOrderId)) {
    notFound();
  }

  const user = await requireUser(`/paiement/retour?commande=${rawOrderId}`);

  let order = await loadOrder(rawOrderId, user.id);
  if (!order) {
    notFound();
  }

  // Au retour du client, on vérifie le paiement auprès du prestataire
  // (utile si la notification n'est pas encore arrivée).
  if (order.status === "PENDING") {
    await syncOrderPayments(order.id);
    order = await loadOrder(rawOrderId, user.id);
    if (!order) {
      notFound();
    }
  }

  if (order.status === "PAID") {
    return (
      <div className="container-page py-8">
        <ClearCart />

        <div className="card mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold text-green-700">Paiement confirmé</h1>
          <p className="mt-1 text-sm text-slate-600">
            Commande {order.number} · {formatPrice(order.totalAmount, order.currency)}
          </p>

          <ul className="mt-6 divide-y divide-slate-100">
            {order.items.map((item) => {
              const download = item.downloads[0];

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-medium">{item.productTitle}</p>
                    {download && (
                      <p className="text-xs text-slate-500">
                        Lien valable jusqu&apos;au {formatDate(download.expiresAt)} ·{" "}
                        {Math.max(download.maxDownloads - download.downloadCount, 0)}{" "}
                        téléchargement(s) restant(s)
                      </p>
                    )}
                  </div>

                  {download ? (
                    <a
                      href={`/api/telechargement/${download.token}`}
                      className="btn-primary"
                    >
                      Télécharger le PDF
                    </a>
                  ) : (
                    <span className="text-sm text-slate-500">Lien indisponible</span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-6">
            <Link href="/catalogue" className="btn-secondary">
              Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (order.status === "PENDING") {
    return (
      <div className="container-page py-8">
        <AutoRefresh />

        <div className="card mx-auto max-w-lg text-center">
          <h1 className="text-2xl font-bold">Paiement en cours de confirmation</h1>
          <p className="mt-2 text-sm text-slate-600">
            Commande {order.number}. Nous attendons la confirmation de votre
            paiement. Cette page se met à jour automatiquement : vos liens de
            téléchargement apparaîtront dès qu&apos;il sera validé.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Si vous payez par Mobile Money, validez la demande sur votre
            téléphone.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold text-red-700">Paiement non abouti</h1>
        <p className="mt-2 text-sm text-slate-600">
          Commande {order.number} : le paiement n&apos;a pas été confirmé et vous
          n&apos;avez pas été débité. Vous pouvez réessayer depuis votre panier.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/panier" className="btn-primary">
            Retour au panier
          </Link>
          <Link href="/catalogue" className="btn-secondary">
            Catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
