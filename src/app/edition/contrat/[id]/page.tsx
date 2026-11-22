// src/app/edition/contrat/[id]/page.tsx
// Lecture, signature en ligne et téléchargement du contrat d'édition à compte d'éditeur (manuscrit retenu).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { signPublisherContractAction } from "@/app/edition/contrat/actions";
import { parseContractText } from "@/lib/contract-text";
import { publisherContractAcceptanceText } from "@/lib/publisher-contract";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mon contrat d'édition",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  signe:
    "Votre contrat est signé. Vous pouvez le télécharger en PDF. TechLibrairie Édition vous tient informé des étapes suivantes.",
};

const ERRORS: Record<string, string> = {
  confirmation: "Cochez la case d'acceptation pour signer le contrat.",
  signature: "Tapez votre nom et prénom : ils valent signature du contrat.",
  etat: "Ce contrat est déjà signé.",
};

export default async function ContratEditeurPage({
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

  const user = await requireUser(`/edition/contrat/${id}`);

  const contract = await prisma.publisherContract.findFirst({
    where: { submissionId: id, userId: user.id },
  });

  if (!contract) {
    notFound();
  }

  const parsed = parseContractText(contract.text);
  const signed = contract.acceptedAt !== null;

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/edition/espace" className="text-sm font-semibold text-brand-700 hover:underline">
            Retour à mon espace auteur
          </Link>
          <p className="eyebrow mt-4 text-accent-700">Édition à compte d&apos;éditeur</p>
          <h1 className="mt-1 text-3xl font-extrabold">Votre contrat d&apos;édition</h1>
          <p className="mt-1 text-sm text-slate-600">
            Œuvre : <strong>{contract.workTitle}</strong> · version {contract.version} · redevance de{" "}
            <strong>{contract.royaltyPercent} %</strong> du prix public hors taxes de chaque exemplaire vendu.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
            {message}
          </div>
        )}
        {error && <div className="alert-error">{error}</div>}

        <section className="card flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {signed ? (
              <p className="font-semibold text-green-700">
                Signé le {contract.acceptedAt ? formatDate(contract.acceptedAt) : "-"} par {contract.signerName}
              </p>
            ) : (
              <p className="font-semibold text-orange-700">En attente de votre signature</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Aucun rendez-vous n&apos;est nécessaire : le contrat se signe en ligne.
            </p>
          </div>

          <a href={`/api/contrat/editeur/${id}`} className="btn-secondary">
            {signed ? "Télécharger le contrat signé (PDF)" : "Télécharger le projet (PDF)"}
          </a>
        </section>

        <article className="card space-y-5 text-sm text-slate-700">
          <header className="space-y-2 text-center">
            <h2 className="text-xl font-extrabold text-slate-900">{parsed.title}</h2>
            <p className="italic text-slate-600">{parsed.subtitle}</p>
          </header>

          {parsed.parties.map((party) => (
            <p key={party}>{party}</p>
          ))}

          {parsed.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h3 className="pt-2 font-bold text-slate-900">{section.heading}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>

        {!signed && (
          <section className="card border-brand-200">
            <h2 className="text-lg font-extrabold">Signer mon contrat</h2>

            <form action={signPublisherContractAction} className="mt-4 space-y-4">
              <input type="hidden" name="submissionId" value={id} />

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
                <span>{publisherContractAcceptanceText(contract.workTitle, contract.royaltyPercent)}</span>
              </label>

              <div>
                <label htmlFor="signature" className="label">
                  Signature : tapez votre nom et prénom
                </label>
                <input
                  id="signature"
                  name="signature"
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  autoComplete="name"
                  className="input"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Le contrat est conservé avec la date, votre nom et l&apos;adresse email de votre compte.
                </p>
              </div>

              <button type="submit" className="btn-primary">
                Signer mon contrat
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
              }
