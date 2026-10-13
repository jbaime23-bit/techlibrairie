// src/app/acheteur/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  DownloadItem,
  type ActiveDownloadLink,
} from "@/components/acheteur/download-item";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mon espace",
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "lien-genere": "Un nouveau lien de téléchargement a été généré.",
  "lien-valide": "Vous avez déjà un lien de téléchargement valide pour cet ouvrage.",
};

const ERRORS: Record<string, string> = {
  introuvable: "Ouvrage introuvable.",
  limite:
    "Limite atteinte : 3 nouveaux liens par ouvrage et par jour. Réessayez demain ou contactez-nous.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AcheteurPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const user = await requireUser("/acheteur");
  const now = new Date();

  const [paidStats, pendingOrders, recentItems, purchasedCount] = await Promise.all([
    prisma.order.groupBy({
      by: ["currency"],
      where: { buyerId: user.id, status: "PAID" },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: {
        buyerId: user.id,
        status: "PENDING",
        createdAt: { gt: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, number: true, totalAmount: true, currency: true, createdAt: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { buyerId: user.id, status: "PAID" } },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        order: { select: { number: true } },
        downloads: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    }),
    prisma.orderItem.count({
      where: { order: { buyerId: user.id, status: "PAID" } },
    }),
  ]);

  const ordersCount = paidStats.reduce((sum, row) => sum + row._count._all, 0);

  const messageKey = firstValue(sp.message);
  const errorKey = firstValue(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Bonjour{user.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Retrouvez ici vos achats et vos liens de téléchargement.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-600">Ouvrages achetés</p>
          <p className="mt-1 text-3xl font-bold">{purchasedCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Commandes payées</p>
          <p className="mt-1 text-3xl font-bold">{ordersCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-600">Total dépensé</p>
          {paidStats.length === 0 ? (
            <p className="mt-1 text-3xl font-bold">0</p>
          ) : (
            paidStats.map((row) => (
              <p key={row.currency} className="mt-1 text-xl font-bold">
                {formatPrice(row._sum.totalAmount ?? 0, row.currency)}
              </p>
            ))
          )}
        </div>
      </div>

      {pendingOrders.length > 0 && (
        <section className="card border-yellow-200 bg-yellow-50">
          <h2 className="text-lg font-semibold text-yellow-900">
            Paiement en attente de confirmation
          </h2>
          <ul className="mt-3 divide-y divide-yellow-100 text-sm">
            {pendingOrders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">
                    Commande {order.number} · {formatPrice(order.totalAmount, order.currency)}
                  </p>
                  <p className="text-xs text-yellow-800">
                    Créée le {formatDate(order.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/paiement/retour?commande=${order.id}`}
                  className="btn-secondary px-3 py-1 text-xs"
                >
                  Vérifier le paiement
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mes derniers achats</h2>
          <Link
            href="/acheteur/commandes"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Toutes mes commandes
          </Link>
        </div>

        {recentItems.length === 0 ? (
          <div className="mt-4 text-sm text-slate-600">
            <p>Vous n&apos;avez pas encore acheté d&apos;ouvrage.</p>
            <div className="mt-4">
              <Link href="/catalogue" className="btn-primary">
                Parcourir le catalogue
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {recentItems.map((item) => {
              const valid = item.downloads.find(
                (download) =>
                  download.expiresAt > now && download.downloadCount < download.maxDownloads
              );
              const link: ActiveDownloadLink | null = valid
                ? {
                    token: valid.token,
                    expiresAt: valid.expiresAt,
                    remaining: valid.maxDownloads - valid.downloadCount,
                  }
                : null;

              return (
                <DownloadItem
                  key={item.id}
                  itemId={item.id}
                  title={item.productTitle}
                  link={link}
                  returnTo="/acheteur"
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
          }
