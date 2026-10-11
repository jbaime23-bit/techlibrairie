// src/app/acheteur/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { OrderItemRow } from "@/components/acheteur/order-item-row";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mes achats",
};

export const dynamic = "force-dynamic";

const LIBRARY_LIMIT = 12;

const LINK_MESSAGES: Record<string, { text: string; success: boolean }> = {
  ok: { text: "Un nouveau lien de téléchargement a été généré.", success: true },
  valide: {
    text: "Votre lien actuel est encore valide : utilisez le bouton « Télécharger le PDF ».",
    success: false,
  },
  limite: {
    text: "Trop de liens ont été générés aujourd'hui pour cet ouvrage. Réessayez demain ou contactez-nous.",
    success: false,
  },
  invalide: { text: "Ouvrage introuvable.", success: false },
};

export default async function AcheteurPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser("/acheteur");

  const [paidOrders, pendingCount, spentByCurrency] = await Promise.all([
    prisma.order.findMany({
      where: { buyerId: user.id, status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 50,
      include: {
        items: {
          include: {
            downloads: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                token: true,
                expiresAt: true,
                maxDownloads: true,
                downloadCount: true,
              },
            },
          },
        },
      },
    }),
    prisma.order.count({ where: { buyerId: user.id, status: "PENDING" } }),
    prisma.order.groupBy({
      by: ["currency"],
      where: { buyerId: user.id, status: "PAID" },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  // Bibliothèque : chaque ouvrage acheté une seule fois (le plus récent d'abord).
  const seenProducts = new Set<string>();
  const library = [];
  for (const order of paidOrders) {
    for (const item of order.items) {
      if (seenProducts.has(item.productId)) continue;
      seenProducts.add(item.productId);
      library.push(item);
    }
  }

  const visibleLibrary = library.slice(0, LIBRARY_LIMIT);
  const ordersTotal = spentByCurrency.reduce((sum, row) => sum + row._count._all, 0);

  const messageKey = firstParam(searchParams.lien);
  const message = messageKey ? LINK_MESSAGES[messageKey] : undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Bonjour{user.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Retrouvez ici vos ouvrages achetés et leurs liens de téléchargement.
        </p>
      </div>

      {message && (
        <div
          className={
            message.success
              ? "rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
              : "alert-error"
          }
        >
          {message.text}
        </div>
      )}

      {pendingCount > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Vous avez {pendingCount} commande{pendingCount > 1 ? "s" : ""} en attente
          de paiement.{" "}
          <Link href="/acheteur/commandes" className="font-semibold underline">
            Voir mes commandes
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-600">Ouvrages achetés</p>
          <p className="mt-1 text-3xl font-bold">{library.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Commandes payées</p>
          <p className="mt-1 text-3xl font-bold">{ordersTotal}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Total dépensé</p>
          {spentByCurrency.length === 0 ? (
            <p className="mt-1 text-3xl font-bold">-</p>
          ) : (
            <div className="mt-1 space-y-1">
              {spentByCurrency.map((row) => (
                <p key={row.currency} className="text-xl font-bold">
                  {formatPrice(row._sum.totalAmount ?? 0, row.currency)}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ma bibliothèque</h2>
          <Link
            href="/acheteur/commandes"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Toutes mes commandes
          </Link>
        </div>

        {visibleLibrary.length === 0 ? (
          <div className="mt-4 text-sm text-slate-600">
            <p>Vous n&apos;avez pas encore acheté d&apos;ouvrage.</p>
            <div className="mt-4">
              <Link href="/catalogue" className="btn-primary">
                Parcourir le catalogue
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-slate-100">
              {visibleLibrary.map((item) => (
                <OrderItemRow key={item.id} item={item} returnTo="dashboard" />
              ))}
            </ul>

            {library.length > LIBRARY_LIMIT && (
              <p className="mt-4 text-xs text-slate-500">
                {library.length - LIBRARY_LIMIT} autre(s) ouvrage(s) disponible(s)
                dans la page « Mes commandes ».
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
          }
