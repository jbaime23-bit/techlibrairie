// src/app/admin/utilisateurs/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  parsePage,
  requireAdmin,
} from "@/lib/admin";
import { Pagination } from "@/components/admin/pagination";
import { setUserActiveAction } from "@/app/admin/utilisateurs/actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Utilisateurs",
};

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<Role, string> = {
  BUYER: "Acheteur",
  SELLER: "Vendeur",
  ADMIN: "Administrateur",
};

const ROLES: Role[] = ["BUYER", "SELLER", "ADMIN"];

type StatusFilter = "actifs" | "desactives";

const MESSAGES: Record<string, string> = {
  desactive:
    "Compte désactivé : l'utilisateur ne peut plus se connecter et sa session est coupée.",
  reactive:
    "Compte réactivé. Si c'est un vendeur, rétablissez son profil depuis la page Vendeurs.",
};

const ERRORS: Record<string, string> = {
  introuvable: "Utilisateur introuvable.",
  "soi-meme": "Vous ne pouvez pas désactiver votre propre compte.",
  admin: "Un compte administrateur ne peut pas être désactivé depuis cette page.",
};

export default async function AdminUtilisateursPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const admin = await requireAdmin("/admin/utilisateurs");

  const q = (firstParam(searchParams.q) ?? "").trim().slice(0, 100);
  const rawRole = firstParam(searchParams.role);
  const role = ROLES.find((value) => value === rawRole);
  const rawStatus = firstParam(searchParams.statut);
  const status: StatusFilter | undefined =
    rawStatus === "actifs" || rawStatus === "desactives" ? rawStatus : undefined;

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(status === "actifs" ? { isActive: true } : {}),
    ...(status === "desactives" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(parsePage(searchParams.page), totalPages);

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { orders: true, supportThreads: true } },
      sellerProfile: {
        select: { displayName: true, status: true, _count: { select: { products: true } } },
      },
    },
  });

  function filterHref(next: { role?: Role; statut?: StatusFilter }): string {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (next.role) search.set("role", next.role);
    if (next.statut) search.set("statut", next.statut);
    const query = search.toString();
    return query ? `/admin/utilisateurs?${query}` : "/admin/utilisateurs";
  }

  const messageKey = firstParam(searchParams.message);
  const errorKey = firstParam(searchParams.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Utilisateurs</h1>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <form method="get" action="/admin/utilisateurs" className="flex flex-wrap gap-3">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nom ou email"
          className="input max-w-xs"
        />
        {role && <input type="hidden" name="role" value={role} />}
        {status && <input type="hidden" name="statut" value={status} />}
        <button type="submit" className="btn-primary">
          Rechercher
        </button>
      </form>

      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <Link
            href={filterHref({ statut: status })}
            className={role ? "btn-secondary" : "btn-primary"}
          >
            Tous les rôles
          </Link>
          {ROLES.map((value) => (
            <Link
              key={value}
              href={filterHref({ role: value, statut: status })}
              className={role === value ? "btn-primary" : "btn-secondary"}
            >
              {ROLE_LABELS[value]}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={filterHref({ role })}
            className={status ? "btn-secondary" : "btn-primary"}
          >
            Tous les statuts
          </Link>
          <Link
            href={filterHref({ role, statut: "actifs" })}
            className={status === "actifs" ? "btn-primary" : "btn-secondary"}
          >
            Actifs
          </Link>
          <Link
            href={filterHref({ role, statut: "desactives" })}
            className={status === "desactives" ? "btn-primary" : "btn-secondary"}
          >
            Désactivés
          </Link>
        </div>
      </div>

      <p className="text-sm text-slate-600">
        {total} utilisateur{total > 1 ? "s" : ""}
      </p>

      {users.length === 0 ? (
        <div className="card text-sm text-slate-600">Aucun utilisateur trouvé.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Activité</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === admin.id;
                const isAdminAccount = user.role === "ADMIN";

                return (
                  <tr key={user.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.name ?? "Sans nom"}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                      <p className="text-xs text-slate-400">
                        Inscrit le {formatDate(user.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {ROLE_LABELS[user.role]}
                      {user.sellerProfile && (
                        <p className="text-xs text-slate-500">
                          {user.sellerProfile.displayName}
                          {user.sellerProfile.status === "SUSPENDED" ? " (suspendu)" : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {user.emailVerified ? (
                        <span className="text-green-700">Vérifié</span>
                      ) : (
                        <span className="text-slate-500">Non vérifié</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p>{user._count.orders} commande(s)</p>
                      <p>{user._count.supportThreads} conversation(s) de support</p>
                      {user.sellerProfile && (
                        <p>{user.sellerProfile._count.products} produit(s)</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`mb-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                          user.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {user.isActive ? "Actif" : "Désactivé"}
                      </span>

                      {isSelf || isAdminAccount ? (
                        <p className="text-xs text-slate-400">
                          {isSelf ? "Votre compte" : "Compte administrateur"}
                        </p>
                      ) : (
                        <form action={setUserActiveAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={user.isActive ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            className={`btn-secondary px-3 py-1 text-xs ${
                              user.isActive ? "text-red-700" : ""
                            }`}
                          >
                            {user.isActive ? "Désactiver" : "Réactiver"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/utilisateurs"
        params={{ q: q || undefined, role, statut: status }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
        }
