// src/app/vendeur/impression/[id]/page.tsx
// Version imprimée d'un livre édité : prix public fixé par l'auteur, prix plancher et gain par exemplaire.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { firstParam } from "@/lib/admin";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { setPrintPriceAction, suspendPrintAction } from "@/app/vendeur/impression/actions";
import {
  PRICE_FLOOR_MARGIN_PERCENT,
  PRINT_STATUS_LABELS,
  PRINT_STATUS_STYLES,
  authorNetPerCopyXof,
  printPriceFloorXof,
} from "@/lib/print-pricing";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Version imprimée de votre livre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  prix: "Votre prix est enregistré : la version imprimée de votre livre est proposée à l'achat.",
  suspendu: "La vente de la version imprimée est suspendue. Vous pouvez la réactiver en fixant un prix.",
};

const ERRORS: Record<string, string> = {
  prix: "Prix invalide : saisissez un nombre entier de FCFA, multiple de 5.",
  plancher:
    "Ce prix est inférieur au prix plancher : il ne couvrirait pas la fabrication d'un exemplaire. Saisissez un prix plus élevé.",
  etat: "La version imprimée n'est pas encore prête : TechLibrairie Édition la prépare.",
};

export default async function PrintEditionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  if (!/^[a-z0-9]{1,40}$/i.test(id)) {
    notFound();
  }

  const context = await loadSellerPage(`/vendeur/impression/${id}`);

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const product = await prisma.product.findFirst({
    where: { id, sellerId: context.seller.id },
    select: { id: true, title: true, kind: true, status: true, priceAmount: true },
  });

  if (!product) {
    notFound();
  }

  if (product.kind !== "BOOK_EDITION" || product.status !== "PUBLISHED") {
    redirect("/vendeur/produits");
  }

  const edition = await prisma.printEdition.findUnique({ where: { productId: product.id } });

  const status = edition?.status ?? "DRAFT";
  const cost = edition?.printCostXof ?? null;
  const floor = cost !== null ? printPriceFloorXof(cost) : null;
  const retail = edition?.retailPriceXof ?? null;
  const canSetPrice = (status === "READY" || status === "ACTIVE") && cost !== null && floor !== null;

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/vendeur/produits" className="text-sm font-semibold text-brand-700 hover:underline">
          Retour à mes produits
        </Link>

        <h1 className="mt-3 text-2xl font-bold">Version imprimée</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ouvrage : <strong>{product.title}</strong>
        </p>
        <span
          className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${PRINT_STATUS_STYLES[status]}`}
        >
          {PRINT_STATUS_LABELS[status]}
        </span>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="card text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Comment ça marche</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Chaque exemplaire imprimé est <strong>fabriqué à la commande</strong> par un prestataire
            d&apos;impression : il n&apos;y a pas de stock et vous n&apos;avancez aucun argent.
          </li>
          <li>
            Les frais de fabrication sont à votre charge, <strong>déduits de chaque vente</strong>. Vous gardez
            100 % du reste. Le lecteur paie la livraison en plus du prix du livre.
          </li>
          <li>
            Vous fixez le prix de l&apos;exemplaire imprimé, <strong>sans pouvoir descendre sous le prix
            plancher</strong> (coût de fabrication + {PRICE_FLOOR_MARGIN_PERCENT} % de marge de sécurité).
          </li>
        </ul>
      </section>

      {status === "DRAFT" && (
        <section className="card border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold">En préparation</h2>
          <p className="mt-1 text-sm text-slate-600">
            TechLibrairie Édition prépare les fichiers d&apos;impression de votre livre et calcule son coût de
            fabrication. Vous pourrez ensuite fixer votre prix ici.
          </p>
        </section>
      )}

      {status === "DISABLED" && (
        <section className="card border-red-200 bg-red-50">
          <h2 className="text-lg font-semibold text-red-900">Format retiré</h2>
          <p className="mt-1 text-sm text-red-900">
            La version imprimée de ce livre a été retirée par TechLibrairie Édition. Contactez-nous pour en savoir
            plus.
          </p>
        </section>
      )}

      {canSetPrice && cost !== null && floor !== null && (
        <>
          <section className="card">
            <h2 className="text-lg font-semibold">Coût et prix plancher</h2>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Coût de fabrication d&apos;un exemplaire</dt>
                <dd className="font-semibold">{formatPrice(cost, "XOF")}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Prix plancher</dt>
                <dd className="font-semibold">{formatPrice(floor, "XOF")}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Prix actuel de l&apos;exemplaire imprimé</dt>
                <dd className="font-semibold">
                  {retail !== null ? formatPrice(retail, "XOF") : "pas encore fixé"}
                </dd>
              </div>
              {retail !== null && (
                <div>
                  <dt className="text-xs text-slate-500">Votre gain par exemplaire</dt>
                  <dd className="font-semibold">{formatPrice(authorNetPerCopyXof(retail, cost), "XOF")}</dd>
                </div>
              )}
            </dl>

            {retail !== null && retail < floor && (
              <p className="mt-3 text-sm text-red-700">
                Le coût de fabrication a évolué : votre prix est maintenant inférieur au plancher, et la vente de
                l&apos;exemplaire imprimé est suspendue. Fixez un nouveau prix pour la rétablir.
              </p>
            )}

            <p className="mt-3 text-xs text-slate-500">
              Pour comparaison, votre version numérique (PDF) est vendue {formatPrice(product.priceAmount, "XOF")}.
            </p>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold">
              {status === "ACTIVE" ? "Modifier mon prix" : "Fixer mon prix et proposer la version imprimée"}
            </h2>

            <form action={setPrintPriceAction} className="mt-3 space-y-3">
              <input type="hidden" name="productId" value={product.id} />

              <div>
                <label htmlFor="price" className="label">
                  Prix d&apos;un exemplaire imprimé en FCFA (multiple de 5, au moins {formatPrice(floor, "XOF")})
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  inputMode="numeric"
                  min={floor}
                  step="5"
                  required
                  defaultValue={retail !== null && retail >= floor ? retail : floor}
                  className="input"
                />
              </div>

              <button type="submit" className="btn-primary">
                {status === "ACTIVE" ? "Enregistrer le nouveau prix" : "Proposer la version imprimée"}
              </button>
            </form>

            {status === "ACTIVE" && (
              <form action={suspendPrintAction} className="mt-4">
                <input type="hidden" name="productId" value={product.id} />
                <button type="submit" className="text-sm text-red-700 hover:underline">
                  Suspendre la vente de la version imprimée
                </button>
              </form>
            )}
          </section>
        </>
      )}

      <p className="text-xs text-slate-500">
        L&apos;ouverture de la commande d&apos;exemplaires imprimés aux lecteurs est en cours de mise en place : votre
        prix est enregistré dès maintenant.
      </p>
    </div>
  );
}
