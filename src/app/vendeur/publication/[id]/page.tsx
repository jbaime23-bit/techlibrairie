// src/app/vendeur/publication/[id]/page.tsx
// Dernière étape avant la publication d'un ouvrage de l'édition de livres :
// règlement de la contribution de participation (Mobile Money, vérifié par l'administration).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { firstParam } from "@/lib/admin";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { declareContributionAction } from "@/app/vendeur/publication/actions";
import {
  CONTRIBUTION_METHODS,
  getContributionConfig,
  paymentReferenceCode,
} from "@/lib/publication-fee";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dernière étape avant la publication",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  declare: "Votre paiement a été déclaré. Il est en cours de vérification par l'administration.",
};

const ERRORS: Record<string, string> = {
  methode: "Choisissez le moyen utilisé : Orange Money ou Moov Money.",
  telephone: "Numéro de téléphone invalide : saisissez 8 à 15 chiffres.",
  reference:
    "Référence de transaction invalide : 4 à 40 caractères (lettres, chiffres, point ou tiret), telle qu'indiquée dans le message de confirmation de votre opérateur.",
  doublon: "Cette référence de transaction a déjà été déclarée pour un autre ouvrage.",
  etat: "Cette contribution n'est plus à déclarer.",
  ferme: "Le règlement n'est pas encore ouvert. Contactez-nous.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

function formatXof(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function ContributionPage({
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

  const context = await loadSellerPage(`/vendeur/publication/${id}`);

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const product = await prisma.product.findFirst({
    where: { id, sellerId: context.seller.id },
    select: {
      id: true,
      title: true,
      status: true,
      publicationFee: {
        select: {
          status: true,
          amountXof: true,
          method: true,
          payerPhone: true,
          paymentReference: true,
          submittedAt: true,
          rejectionReason: true,
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  if (product.status !== "PENDING_PAYMENT" || !product.publicationFee) {
    redirect("/vendeur/produits");
  }

  const fee = product.publicationFee;
  const config = getContributionConfig();
  const code = paymentReferenceCode(product.id);
  const canDeclare = fee.status === "AWAITING_PAYMENT" || fee.status === "REJECTED";
  const verifying = fee.status === "SUBMITTED";

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

        <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm" aria-label="Étapes">
          <li className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-800">
            1. Votre livre : envoyé
          </li>
          <li
            className={`rounded-full px-3 py-1 font-semibold ${
              verifying ? "bg-green-100 text-green-800" : "bg-brand-600 text-white"
            }`}
          >
            {verifying ? "2. Contribution : déclarée" : "2. Dernière étape : contribution"}
          </li>
          <li
            className={`rounded-full px-3 py-1 ${
              verifying ? "bg-yellow-100 font-semibold text-yellow-800" : "bg-slate-100 text-slate-600"
            }`}
          >
            3. Publication
          </li>
        </ol>

        <h1 className="mt-4 text-2xl font-bold">Dernière étape avant la publication</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ouvrage : <strong>{product.title}</strong>
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="card">
        <p className="text-sm text-slate-700">
          Votre livre est prêt. Pour le publier sur TechLibrairie, une contribution unique de{" "}
          <strong>{formatXof(fee.amountXof)}</strong> est demandée pour cet ouvrage. Votre livre est publié dès
          que ce paiement est reçu et validé.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Cette contribution sert exclusivement de participation au soutien technique et à l&apos;hébergement
            du site.
          </li>
          <li>
            Elle n&apos;a aucun effet sur vos redevances : la commission et vos revenus sur les ventes restent
            inchangés.
          </li>
        </ul>
      </section>

      {verifying && (
        <section className="card border-yellow-200 bg-yellow-50">
          <h2 className="text-lg font-semibold text-yellow-900">Paiement en cours de vérification</h2>
          <p className="mt-1 text-sm text-yellow-900">
            Vous avez déclaré votre paiement
            {fee.submittedAt ? ` le ${formatDate(fee.submittedAt)}` : ""} (référence{" "}
            <strong>{fee.paymentReference ?? "-"}</strong>). L&apos;administration le vérifie sur son compte
            Mobile Money : votre livre sera publié dès la validation.
          </p>
        </section>
      )}

      {fee.status === "REJECTED" && (
        <div className="alert-error">
          <p className="font-semibold">Votre paiement n&apos;a pas pu être validé.</p>
          {fee.rejectionReason && <p className="mt-1">Motif : {fee.rejectionReason}</p>}
          <p className="mt-1">Vérifiez les informations ci-dessous, puis déclarez-le à nouveau.</p>
        </div>
      )}

      {canDeclare && (
        <>
          <section className="card">
            <h2 className="text-lg font-semibold">1. Envoyez {formatXof(fee.amountXof)} par Mobile Money</h2>

            {config.paymentOpen ? (
              <ul className="mt-3 space-y-2 text-sm">
                {config.orangeNumber && (
                  <li className="rounded-lg border border-slate-200 p-3">
                    <span className="block text-xs text-slate-500">Orange Money</span>
                    <span className="text-lg font-bold">{config.orangeNumber}</span>
                  </li>
                )}
                {config.moovNumber && (
                  <li className="rounded-lg border border-slate-200 p-3">
                    <span className="block text-xs text-slate-500">Moov Money</span>
                    <span className="text-lg font-bold">{config.moovNumber}</span>
                  </li>
                )}
                <li className="text-slate-600">
                  Si votre application le permet, indiquez dans le message du transfert la référence{" "}
                  <strong>{code}</strong> : elle permet de retrouver votre paiement.
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                Le règlement n&apos;est pas encore ouvert. Contactez-nous par le formulaire en bas de page ou
                par WhatsApp : nous vous indiquerons comment procéder.
              </p>
            )}
          </section>

          {config.paymentOpen && (
            <section className="card">
              <h2 className="text-lg font-semibold">2. Déclarez votre paiement</h2>
              <p className="mt-1 text-sm text-slate-600">
                Après le transfert, recopiez les informations du message de confirmation de votre opérateur.
              </p>

              <form action={declareContributionAction} className="mt-4 space-y-4">
                <input type="hidden" name="productId" value={product.id} />

                <div>
                  <label htmlFor="method" className="label">
                    Moyen utilisé
                  </label>
                  <select
                    id="method"
                    name="method"
                    required
                    defaultValue={fee.method ?? ""}
                    className="input"
                  >
                    <option value="" disabled>
                      Choisir...
                    </option>
                    {CONTRIBUTION_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="payerPhone" className="label">
                    Numéro depuis lequel vous avez envoyé l&apos;argent
                  </label>
                  <input
                    id="payerPhone"
                    name="payerPhone"
                    type="tel"
                    inputMode="tel"
                    required
                    defaultValue={fee.payerPhone ?? ""}
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="reference" className="label">
                    Référence de la transaction
                  </label>
                  <input
                    id="reference"
                    name="reference"
                    type="text"
                    required
                    autoComplete="off"
                    defaultValue={fee.paymentReference ?? ""}
                    className="input"
                  />
                </div>

                <button type="submit" className="btn-primary">
                  Déclarer mon paiement
                </button>
              </form>
            </section>
          )}
        </>
      )}
    </div>
  );
                    }
