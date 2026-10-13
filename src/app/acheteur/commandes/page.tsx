// src/app/acheteur/commandes/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import {
  DownloadItem,
  type ActiveDownloadLink,
} from "@/components/acheteur/download-item";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mes commandes",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = Math.min(ADMIN_PAGE_SIZE, 10);

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  FAILED: "Échouée",
  CANCELED: "Annulée",
  REFUNDED: "Remboursée",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELED: "bg-slate-100 text-slate-700",
  REFUNDED: "bg-purple-100 text-purple-800",
};

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

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const user = await requireUser("/acheteur/commandes");
  const now = new Date();

  const total = await prisma.order.count({ where: { buyerId: user.id } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(sp.page), totalPages);

  const orders = await prisma.order.findMany({
    where: { buyerId: user.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      items: {
        include: {
          downloads: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      },
    },
  });

  const messageKey = firstValue(sp.message);
  const errorKey = firstValue(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  const returnTo = page > 1 ? `/acheteur/commandes?page=${page}` : "/acheteur/commandes";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mes commandes</h1>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <p className="text-sm text-slate-600">
        {total} commande{total > 1 ? "s" : ""}
      </p>

      {orders.length === 0 ? (
        <div className="card text-center">
          <p className="text-sm text-slate-600">
            Vous n&apos;avez pas encore passé de commande.
          </p>
          <div className="mt-4">
            <Link href="/catalogue" className="btn-primary">
              Parcourir le catalogue
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-6">
          {orders.map((order) => (
            <li key={order.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Commande {order.number}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(order.createdAt)} ·{" "}
                    {formatPrice(order.totalAmount, order.currency)}
                  </p>
                </div>
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[order.status]}`}
                >
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              {order.status === "PAID" ? (
                <ul className="mt-2 divide-y divide-slate-100">
                  {order.items.map((item) => {
                    const valid = item.downloads.find(
                      (download) =>
                        download.expiresAt > now &&
                        download.downloadCount < download.maxDownloads
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
                        returnTo={returnTo}
                      />
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-3 space-y-3">
                  <ul className="text-sm text-slate-700">
                    {order.items.map((item) => (
                      <li key={item.id}>{item.productTitle}</li>
                    ))}
                  </ul>

                  {order.status === "PENDING" && (
                    <Link
                      href={`/paiement/retour?commande=${order.id}`}
                      className="btn-secondary px-3 py-1 text-xs"
                    >
                      Vérifier le paiement
                    </Link>
                  )}

                  {(order.status === "FAILED" || order.status === "CANCELED") && (
                    <p className="text-xs text-slate-500">
                      Le paiement n&apos;a pas abouti et vous n&apos;avez pas été débité.
                      Vous pouvez recommencer depuis le catalogue.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/acheteur/commandes"
        params={{}}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
