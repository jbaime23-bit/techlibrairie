// src/app/vendeur/publication/[id]/page.tsx
// Suivi de l'édition d'un livre à compte d'auteur : étapes, règlement du forfait (Mobile Money, vérifié
// par l'administration), puis bon à tirer (relecture de l'épreuve, approbation ou corrections).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { firstParam } from "@/lib/admin";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import {
  approveProofAction,
  declareContributionAction,
  requestProofChangesAction,
} from "@/app/vendeur/publication/actions";
import {
  CONTRIBUTION_METHODS,
  getContributionConfig,
  paymentReferenceCode,
} from "@/lib/publication-fee";
import {
  INCLUDED_CORRECTION_ROUNDS,
  LAYOUT_DELAY_DAYS,
  PROOF_REVIEW_DAYS,
  batApprovalText,
} from "@/lib/edition-proof";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Suivi de votre édition",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  declare: "Votre paiement a été déclaré. Il est en cours de vérification par l'administration.",
  publie: "Félicitations : votre livre est publié.",
  corrections: "Vos corrections ont été transmises. Une nouvelle épreuve vous sera envoyée.",
};

const ERRORS: Record<string, string> = {
  methode: "Choisissez le moyen utilisé : Orange Money ou Moov Money.",
  telephone: "Numéro de téléphone invalide : saisissez 8 à 15 chiffres.",
  reference:
    "Référence de transaction invalide : 4 à 40 caractères (lettres, chiffres, point ou tiret), telle qu'indiquée dans le message de confirmation de votre opérateur.",
  doublon: "Cette référence de transaction a déjà été déclarée pour un autre ouvrage.",
  etat: "Ce forfait n'est plus à déclarer.",
  ferme: "Le règlement n'est pas encore ouvert. Contactez-nous.",
  "bat-case": "Cochez la case d'approbation pour publier votre livre.",
  "bat-nom": "Tapez votre nom et prénom : il vaut signature de votre approbation.",
  "bat-etat": "Cette épreuve n'est plus à valider. Rechargez la page.",
  "bat-version": "Une nouvelle épreuve a été déposée entre-temps. Rechargez la page et relisez-la.",
  "corrections-texte": "Décrivez les corrections demandées (10 caractères au minimum).",
  "corrections-limite": `Les ${INCLUDED_CORRECTION_ROUNDS} séries de corrections incluses sont utilisées : contactez-nous pour un devis.`,
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

type StepState = "done" | "current" | "todo";

const STEP_STYLES: Record<StepState, string> = {
  done: "bg-green-100 text-green-800",
  current: "bg-brand-600 text-white",
  todo: "bg-slate-100 text-slate-600",
};

function formatXof(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function EditionTrackingPage({
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
      slug: true,
      status: true,
      publicationFee: {
        select: {
          status: true,
          amountXof: true,
          method: true,
          payerPhone: true,
          paymentReference: true,
          submittedAt: true,
          validatedAt: true,
          rejectionReason: true,
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const project = await prisma.editionProject.findUnique({
    where: { productId: product.id },
    select: {
      stage: true,
      contractVersion: true,
      contractAcceptedAt: true,
      signerName: true,
      refusalReason: true,
      proofVersion: true,
      proofUploadedAt: true,
      correctionRounds: true,
      changeRequest: true,
      approvedAt: true,
      approvedByName: true,
    },
  });

  const refused = project?.stage === "REFUSED";
  const published = project?.stage === "PUBLISHED";

  if (!product.publicationFee || (!refused && !published && product.status !== "PENDING_PAYMENT")) {
    redirect("/vendeur/produits");
  }

  const fee = product.publicationFee;
  const config = getContributionConfig();
  const code = paymentReferenceCode(product.id);
  const stage = project?.stage ?? "FEE_PENDING";
  const canDeclare = !refused && !published && (fee.status === "AWAITING_PAYMENT" || fee.status === "REJECTED");
  const verifying = !refused && !published && fee.status === "SUBMITTED";
  const proofStage = stage === "PROOF_PENDING";
  const changesStage = stage === "CHANGES_REQUESTED";
  const roundsLeft = project ? INCLUDED_CORRECTION_ROUNDS - project.correctionRounds : 0;

  const feeStep: StepState = fee.status === "VALIDATED" ? "done" : "current";
  const layoutStep: StepState =
    stage === "IN_LAYOUT" ? "current" : stage === "FEE_PENDING" ? "todo" : "done";
  const proofStep: StepState = proofStage || changesStage ? "current" : published ? "done" : "todo";

  const steps: { label: string; state: StepState }[] = [
    { label: "1. Dépôt", state: "done" },
    { label: "2. Contrat", state: project ? "done" : "todo" },
    { label: "3. Forfait", state: refused ? "todo" : feeStep },
    { label: "4. Mise en page", state: refused ? "todo" : layoutStep },
    { label: "5. Bon à tirer", state: refused ? "todo" : proofStep },
    { label: "6. Publication", state: published ? "done" : "todo" },
  ];

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

        <h1 className="mt-3 text-2xl font-bold">Suivi de votre édition</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ouvrage : <strong>{product.title}</strong>
        </p>

        <ol className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm" aria-label="Étapes">
          {steps.map((step) => (
            <li key={step.label} className={`rounded-full px-3 py-1 font-semibold ${STEP_STYLES[step.state]}`}>
              {step.label}
            </li>
          ))}
        </ol>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      {project && (
        <section className="card text-sm text-slate-600">
          Contrat d&apos;édition à compte d&apos;auteur (version {project.contractVersion}) accepté le{" "}
          {formatDate(project.contractAcceptedAt)} par <strong>{project.signerName}</strong>.{" "}
          <Link href="/contrat-edition" className="font-semibold text-brand-700 hover:underline">
            Relire le contrat
          </Link>
        </section>
      )}

      {published && (
        <section className="card border-green-200 bg-green-50">
          <h2 className="text-lg font-semibold text-green-900">Votre livre est publié</h2>
          <p className="mt-1 text-sm text-green-900">
            Vous avez approuvé l&apos;épreuve
            {project?.approvedAt ? ` le ${formatDate(project.approvedAt)}` : ""}. Votre livre est en vente sur
            TechLibrairie : vous gardez vos droits et 100 % de vos gains.
          </p>
          <div className="mt-3">
            <Link href={`/catalogue/${product.slug}`} className="btn-primary">
              Voir la page de mon livre
            </Link>
          </div>
        </section>
      )}

      {refused && (
        <div className="alert-error">
          <p className="font-semibold">Votre livre n&apos;a pas pu être retenu pour l&apos;édition.</p>
          {project?.refusalReason && <p className="mt-1">Motif : {project.refusalReason}</p>}
          <p className="mt-1">
            Si vous aviez réglé le forfait, il vous est remboursé intégralement : l&apos;administration vous
            contacte pour le remboursement.
          </p>
        </div>
      )}

      {!refused && !published && (
        <section className="card">
          <p className="text-sm text-slate-700">
            Pour lancer l&apos;édition de votre livre, le forfait d&apos;édition de{" "}
            <strong>{formatXof(fee.amountXof)}</strong> est demandé pour cet ouvrage. Il couvre le contrôle, la
            mise en page et la publication. Vous gardez vos droits et 100 % de vos gains.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>
              Les frais d&apos;impression des exemplaires imprimés sont à votre charge : ils sont déduits de
              chaque vente, sans avance de votre part.
            </li>
            <li>Votre livre n&apos;est publié qu&apos;après votre approbation du bon à tirer.</li>
          </ul>
        </section>
      )}

      {verifying && (
        <section className="card border-yellow-200 bg-yellow-50">
          <h2 className="text-lg font-semibold text-yellow-900">Paiement en cours de vérification</h2>
          <p className="mt-1 text-sm text-yellow-900">
            Vous avez déclaré votre paiement
            {fee.submittedAt ? ` le ${formatDate(fee.submittedAt)}` : ""} (référence{" "}
            <strong>{fee.paymentReference ?? "-"}</strong>). L&apos;administration le vérifie sur son compte
            Mobile Money. Le contrôle et la mise en page commencent dès la validation.
          </p>
        </section>
      )}

      {stage === "IN_LAYOUT" && fee.status === "VALIDATED" && (
        <section className="card border-green-200 bg-green-50">
          <h2 className="text-lg font-semibold text-green-900">Forfait validé : mise en page en cours</h2>
          <p className="mt-1 text-sm text-green-900">
            TechLibrairie Édition contrôle votre livre puis réalise sa mise en page (délai indicatif de{" "}
            {LAYOUT_DELAY_DAYS} jours à compter du règlement du forfait). Vous recevrez un email avec
            l&apos;épreuve à relire avant toute publication.
          </p>
        </section>
      )}

      {changesStage && project && (
        <section className="card border-orange-200 bg-orange-50">
          <h2 className="text-lg font-semibold text-orange-900">Corrections en cours</h2>
          <p className="mt-1 text-sm text-orange-900">
            Vos corrections ont été transmises : TechLibrairie Édition prépare une nouvelle épreuve. Vous
            serez prévenu par email.
          </p>
          {project.changeRequest && (
            <p className="mt-2 whitespace-pre-line rounded bg-white p-3 text-sm text-slate-700">
              {project.changeRequest}
            </p>
          )}
        </section>
      )}

      {proofStage && project && (
        <>
          <section className="card border-yellow-200 bg-yellow-50">
            <h2 className="text-lg font-semibold text-yellow-900">Votre épreuve est prête (version {project.proofVersion})</h2>
            <p className="mt-1 text-sm text-yellow-900">
              Relisez-la attentivement
              {project.proofUploadedAt ? ` (déposée le ${formatDate(project.proofUploadedAt)})` : ""}. Vous
              disposez de {PROOF_REVIEW_DAYS} jours pour l&apos;approuver ou demander des corrections. Rien
              n&apos;est publié sans votre accord.
            </p>
            <div className="mt-3">
              <a href={`/api/vendeur/edition/${product.id}/epreuve`} className="btn-primary">
                Télécharger l&apos;épreuve (PDF)
              </a>
            </div>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold">J&apos;approuve l&apos;épreuve</h2>
            <form action={approveProofAction} className="mt-3 space-y-4">
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="version" value={project.proofVersion} />

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" name="approve" value="oui" required className="mt-1" />
                <span>{batApprovalText(project.proofVersion)}</span>
              </label>

              <div>
                <label htmlFor="signerName" className="label">
                  Signature : tapez votre nom et prénom
                </label>
                <input
                  id="signerName"
                  name="signerName"
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  autoComplete="name"
                  defaultValue={project.signerName}
                  className="input"
                />
              </div>

              <button type="submit" className="btn-primary">
                Approuver et publier mon livre
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold">Je demande des corrections</h2>

            {roundsLeft > 0 ? (
              <form action={requestProofChangesAction} className="mt-3 space-y-4">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="version" value={project.proofVersion} />

                <p className="text-sm text-slate-600">
                  Il vous reste {roundsLeft} série{roundsLeft > 1 ? "s" : ""} de corrections incluse
                  {roundsLeft > 1 ? "s" : ""} dans votre forfait. Listez toutes vos demandes en une fois, avec les
                  numéros de pages.
                </p>

                <div>
                  <label htmlFor="message" className="label">
                    Corrections demandées
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    required
                    minLength={10}
                    maxLength={2000}
                    className="input"
                  />
                </div>

                <button type="submit" className="btn-secondary">
                  Envoyer mes corrections
                </button>
              </form>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                Les {INCLUDED_CORRECTION_ROUNDS} séries de corrections incluses dans votre forfait sont utilisées.
                Pour demander des modifications supplémentaires, contactez-nous par le formulaire en bas de
                page : un devis vous sera proposé. Vous pouvez aussi approuver l&apos;épreuve en l&apos;état.
              </p>
            )}
          </section>
        </>
      )}

      {fee.status === "REJECTED" && !refused && !published && (
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
