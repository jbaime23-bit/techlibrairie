// src/app/admin/promotions/page.tsx
import type { Metadata } from "next";
import type { PromoBearer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import {
  createPromoAction,
  deletePromoAction,
  togglePromoAction,
} from "@/app/admin/promotions/actions";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Codes promotionnels",
};

export const dynamic = "force-dynamic";

const BEARER_LABELS: Record<PromoBearer, string> = {
  PROPORTIONAL: "Partagée (boutique et vendeur)",
  SHOP: "Boutique seule",
};

const MESSAGES: Record<string, string> = {
  cree: "Code promotionnel créé.",
  supprime: "Code promotionnel supprimé.",
};

const ERRORS: Record<string, string> = {
  code: "Code invalide : 3 à 30 caractères (lettres, chiffres, tirets), sans espace.",
  type: "Choisissez le type de remise.",
  valeur: "Saisissez la valeur de la remise (nombre entier).",
  pourcentage: "Le pourcentage doit être compris entre 1 et 90.",
  montant: "Le montant doit être un multiple de 5, entre 100 et 1 000 000 FCFA.",
  repartition: "Choisissez qui supporte la remise.",
  minimum: "Montant minimum d'achat invalide (nombre entier de FCFA, 10 000 000 au maximum).",
  dates: "Dates invalides, ou date de fin antérieure à la date de début.",
  "limite-totale": "Nombre total d'utilisations invalide (de 1 à 1 000 000).",
  "limite-acheteur": "Nombre d'utilisations par acheteur invalide (de 1 à 100).",
  existe: "Ce code existe déjà.",
  utilise: "Ce code a déjà servi : désactivez-le plutôt que de le supprimer.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/promotions");

  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const ids = promos.map((promo) => promo.id);

  const [paidStats, anyOrders] = await Promise.all([
    ids.length
      ? prisma.order.groupBy({
          by: ["promoCodeId"],
          where: { promoCodeId: { in: ids }, status: "PAID" },
          _count: { _all: true },
          _sum: { discountAmount: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.order.groupBy({
          by: ["promoCodeId"],
          where: { promoCodeId: { in: ids } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const paidById = new Map(
    paidStats.map((row) => [
      row.promoCodeId,
      { uses: row._count._all, discount: row._sum.discountAmount ?? 0 },
    ])
  );
  const usedAnywhere = new Set(anyOrders.map((row) => row.promoCodeId));

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;
  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Codes promotionnels</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les codes s&apos;appliquent aux paniers en FCFA. Le montant à payer ne descend jamais sous
          100 FCFA, et la remise est toujours un multiple de 5.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="card">
        <h2 className="text-lg font-semibold">Créer un code</h2>

        <form action={createPromoAction} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-code" className="label">
                Code (par exemple BIENVENUE10)
              </label>
              <input
                id="promo-code"
                name="code"
                type="text"
                required
                maxLength={30}
                autoCapitalize="characters"
                autoComplete="off"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="promo-description" className="label">
                Note interne (facultatif)
              </label>
              <input
                id="promo-description"
                name="description"
                type="text"
                maxLength={120}
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-type" className="label">
                Type de remise
              </label>
              <select id="promo-type" name="type" required defaultValue="PERCENT" className="input">
                <option value="PERCENT">Pourcentage du panier</option>
                <option value="FIXED">Montant fixe en FCFA</option>
              </select>
            </div>
            <div>
              <label htmlFor="promo-value" className="label">
                Valeur (1 à 90 pour un pourcentage ; multiple de 5 pour un montant)
              </label>
              <input
                id="promo-value"
                name="value"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="promo-bearer" className="label">
              Qui supporte la remise ?
            </label>
            <select
              id="promo-bearer"
              name="bearer"
              required
              defaultValue="PROPORTIONAL"
              className="input"
            >
              <option value="PROPORTIONAL">
                Partagée : la commission est calculée sur le prix remisé
              </option>
              <option value="SHOP">
                Boutique seule : le vendeur garde son gain normal (remise plafonnée à la commission)
              </option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-min" className="label">
                Montant minimum d&apos;achat en FCFA (facultatif)
              </label>
              <input
                id="promo-min"
                name="minOrder"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="promo-max" className="label">
                Nombre total d&apos;utilisations (vide = illimité)
              </label>
              <input
                id="promo-max"
                name="maxRedemptions"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="promo-start" className="label">
                Valable à partir du (facultatif)
              </label>
              <input id="promo-start" name="startsAt" type="date" className="input" />
            </div>
            <div>
              <label htmlFor="promo-end" className="label">
                Jusqu&apos;au, inclus (facultatif)
              </label>
              <input id="promo-end" name="endsAt" type="date" className="input" />
            </div>
            <div>
              <label htmlFor="promo-per-user" className="label">
                Utilisations par acheteur
              </label>
              <input
                id="promo-per-user"
                name="maxPerUser"
                type="number"
                inputMode="numeric"
                min="1"
                max="100"
                step="1"
                defaultValue={1}
                className="input"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary">
            Créer le code
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Codes existants ({promos.length})
        </h2>

        {promos.length === 0 ? (
          <div className="card text-sm text-slate-600">Aucun code pour le moment.</div>
        ) : (
          <ul className="space-y-4">
            {promos.map((promo) => {
              const stats = paidById.get(promo.id);
              const expired = promo.endsAt !== null && promo.endsAt <= now;
              const notStarted = promo.startsAt !== null && promo.startsAt > now;
              const state = !promo.isActive
                ? { label: "Désactivé", style: "bg-slate-200 text-slate-700" }
                : expired
                  ? { label: "Expiré", style: "bg-red-100 text-red-800" }
                  : notStarted
                    ? { label: "Pas encore valable", style: "bg-yellow-100 text-yellow-800" }
                    : { label: "Actif", style: "bg-green-100 text-green-800" };

              return (
                <li key={promo.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-lg font-bold">{promo.code}</p>
                      {promo.description && (
                        <p className="text-sm text-slate-600">{promo.description}</p>
                      )}
                      <p className="mt-1 text-sm">
                        Remise :{" "}
                        <strong>
                          {promo.type === "PERCENT"
                            ? `${promo.value} %`
                            : formatPrice(promo.value, "XOF")}
                        </strong>{" "}
                        · {BEARER_LABELS[promo.bearer]}
                      </p>
                    </div>

                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${state.style}`}
                    >
                      {state.label}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-0.5 text-xs text-slate-500">
                    <li>
                      Utilisations payées : {stats?.uses ?? 0}
                      {promo.maxRedemptions !== null ? ` sur ${promo.maxRedemptions}` : ""} ·
                      remises accordées : {formatPrice(stats?.discount ?? 0, "XOF")}
                    </li>
                    <li>
                      {promo.minOrderAmountXof > 0
                        ? `Achat minimum : ${formatPrice(promo.minOrderAmountXof, "XOF")} · `
                        : ""}
                      {promo.maxPerUser} utilisation{promo.maxPerUser > 1 ? "s" : ""} par acheteur
                    </li>
                    <li>
                      {promo.startsAt ? `Du ${formatDate(promo.startsAt)}` : "Sans date de début"}
                      {" · "}
                      {promo.endsAt ? `jusqu'au ${formatDate(promo.endsAt)}` : "sans date de fin"}
                    </li>
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={togglePromoAction}>
                      <input type="hidden" name="promoId" value={promo.id} />
                      <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                        {promo.isActive ? "Désactiver" : "Réactiver"}
                      </button>
                    </form>

                    {!usedAnywhere.has(promo.id) && (
                      <form action={deletePromoAction}>
                        <input type="hidden" name="promoId" value={promo.id} />
                        <button
                          type="submit"
                          className="btn-secondary px-3 py-1 text-xs text-red-700"
                        >
                          Supprimer
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Un code est compté comme utilisé quand la commande est <strong>payée</strong>, et pendant
            2 heures par les commandes en cours d&apos;autres acheteurs. En cas de paiements simultanés,
            la limite peut être dépassée de une ou deux utilisations.
          </li>
          <li>
            Un code <strong>déjà utilisé</strong> ne peut plus être supprimé : désactivez-le pour
            conserver l&apos;historique.
          </li>
          <li>
            Un remboursement rembourse le montant réellement payé. L&apos;utilisation du code n&apos;est
            alors plus comptée.
          </li>
          <li>
            Avec la règle « boutique seule », la remise ne peut pas dépasser la commission normale
            de la boutique sur le panier : le vendeur garde alors exactement son gain habituel.
          </li>
        </ul>
      </section>
    </div>
  );
}
