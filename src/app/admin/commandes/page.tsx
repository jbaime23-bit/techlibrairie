// src/app/admin/commandes/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  parsePage,
  requireAdmin,
} from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Commandes",
};

export const dynamic = "force-dynamic";

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

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  STRIPE: "Stripe",
  CINETPAY: "CinetPay",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: "Carte",
  MOBILE_MONEY: "Mobile Money",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
};

const STATUSES: OrderStatus[] = ["PENDING", "PAID", "FAILED", "CANCELED", "REFUNDED"];

export default async function AdminCommandesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/commandes");

  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);
  const rawStatus = firstParam(sp.statut);
  const status = STATUSES.find((value) => value === rawStatus);

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { buyerEmail: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await prisma.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(parsePage(sp.page), totalPages);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    include: {
      payments: {
        select: { provider: true, method: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      items: { select: { productTitle: true } },
    },
  });

  function filterHref(value?: OrderStatus): string {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (value) search.set("statut", value);
    const query = search.toString();
    return query ? `/admin/commandes?${query}` : "/admin/commandes";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Commandes</h1>

      <form method="get" action="/admin/commandes" className="flex flex-wrap gap-3">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Numéro ou email de l'acheteur"
          className="input max-w-xs"
        />
        {status && <input type="hidden" name="statut" value={status} />}
        <button type="submit" className="btn-primary">
          Rechercher
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={filterHref()}
          className={status ? "btn-secondary" : "btn-primary"}
        >
          Toutes
        </Link>
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={filterHref(value)}
            className={status === value ? "btn-primary" : "btn-secondary"}
          >
            {STATUS_LABELS[value]}
          </Link>
        ))}
      </div>

      <p className="text-sm text-slate-600">
        {total} commande{total > 1 ? "s" : ""}
      </p>

      {orders.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucune commande trouvée.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 font-medium">Ouvrages</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Paiement</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const payment = order.payments[0];

                return (
                  <tr key={order.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/commandes/${order.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {order.number}
                      </Link>
                      <p className="text-xs text-slate-500">{order.buyerEmail}</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(order.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {order.items.map((item, index) => (
                        <p key={`${order.id}-${index}`} className="text-xs">
                          {item.productTitle}
                        </p>
                      ))}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatPrice(order.totalAmount, order.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {payment
                        ? `${PROVIDER_LABELS[payment.provider]} · ${METHOD_LABELS[payment.method]}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[order.status]}`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/commandes"
        params={{ q: q || undefined, statut: status }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
        }
