// src/app/edition/droits/page.tsx
// Droits d'auteur d'un auteur à compte d'éditeur : ventes, droits acquis par livre, relevés annuels en PDF.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PAYOUT_HOLD_DAYS } from "@/lib/payouts";
import { computeRoyalties } from "@/lib/royalties";
import { formatXofAmount } from "@/lib/edition-offers";

export const metadata: Metadata = {
  title: "Mes droits d'auteur",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DroitsAuteurPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/edition/connexion?callbackUrl=${encodeURIComponent("/edition/droits")}`);
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true },
  });

  if (!seller) {
    redirect("/edition/espace");
  }

  const threshold = new Date(Date.now() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);

  const [report, agreements] = await Promise.all([
    computeRoyalties({ authorSellerId: seller.id, releaseThreshold: threshold }),
    prisma.royaltyAgreement.findMany({
      where: { authorSellerId: seller.id, active: true },
      select: { linkedAt: true },
    }),
  ]);

  const currentYear = new Date().getUTCFullYear();
  const firstYear = agreements.reduce(
    (min, agreement) => Math.min(min, agreement.linkedAt.getUTCFullYear()),
    currentYear
  );
  const years: number[] = [];
  for (let year = currentYear; year >= firstYear; year -= 1) years.push(year);

  const waiting = Math.max(0, report.earnedXof - report.releasedXof);

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <Link href="/edition/espace" className="text-sm font-semibold text-brand-700 hover:underline">
            Retour à mon espace auteur
          </Link>
          <p className="eyebrow mt-4 text-accent-700">Édition à compte d&apos;éditeur</p>
          <h1 className="mt-1 text-3xl font-extrabold">Mes droits d&apos;auteur</h1>
          <p className="mt-1 text-sm text-slate-600">
            Vos droits sont calculés sur le prix public hors taxes de chaque exemplaire vendu et payé, livraison
            exclue, selon le taux de votre contrat.
          </p>
        </div>

        {report.lines.length === 0 ? (
          <div className="card text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Aucun livre n&apos;est encore lié à votre contrat.</p>
            <p className="mt-1">
              Les droits apparaissent ici dès que TechLibrairie Édition a publié votre livre et l&apos;a rattaché à
              votre contrat d&apos;édition.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card text-center">
                <p className="text-xs text-slate-500">Droits acquis (total)</p>
                <p className="mt-1 text-2xl font-extrabold text-brand-700">{formatXofAmount(report.earnedXof)}</p>
              </div>
              <div className="card text-center">
                <p className="text-xs text-slate-500">Déjà retirables</p>
                <p className="mt-1 text-2xl font-extrabold text-green-700">{formatXofAmount(report.releasedXof)}</p>
              </div>
              <div className="card text-center">
                <p className="text-xs text-slate-500">En attente de déblocage</p>
                <p className="mt-1 text-2xl font-extrabold">{formatXofAmount(waiting)}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Ces montants sont inclus dans votre solde : demandez votre versement par Mobile Money depuis{" "}
              <Link href="/vendeur/revenus" className="font-semibold text-brand-700 hover:underline">
                « Mes revenus »
              </Link>
              . Les droits deviennent retirables {PAYOUT_HOLD_DAYS} jours après le paiement pour un livre numérique,
              et après l&apos;expédition pour un exemplaire imprimé.
            </p>

            <section className="space-y-4">
              <h2 className="text-xl font-extrabold">Détail par livre</h2>

              <ul className="space-y-3">
                {report.lines.map((line) => (
                  <li key={line.agreementId} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{line.title}</p>
                      <span className="badge bg-accent-100 text-accent-800">Taux : {line.percent} %</span>
                    </div>

                    <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">Livre numérique (PDF)</dt>
                        <dd>
                          {line.digitalCopies.toLocaleString("fr-FR")} exemplaire{line.digitalCopies > 1 ? "s" : ""} ·{" "}
                          <strong>{formatXofAmount(line.digitalRoyaltyXof)}</strong>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Livre imprimé à la demande</dt>
                        <dd>
                          {line.printCopies.toLocaleString("fr-FR")} exemplaire{line.printCopies > 1 ? "s" : ""} ·{" "}
                          <strong>{formatXofAmount(line.printRoyaltyXof)}</strong>
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">Droits acquis sur ce livre</dt>
                        <dd className="text-base font-bold">{formatXofAmount(line.earnedXof)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-extrabold">Relevés annuels (PDF)</h2>
              <p className="text-sm text-slate-600">
                L&apos;état de chaque année, arrêté au 31 décembre, est téléchargeable ici (article 9 de votre
                contrat). L&apos;année en cours est un état provisoire.
              </p>

              <div className="flex flex-wrap gap-2">
                {years.map((year) => (
                  <a key={year} href={`/api/droits/releve/${year}`} className="btn-secondary px-4 py-2 text-sm">
                    Relevé {year}
                    {year === currentYear ? " (provisoire)" : ""}
                  </a>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
                    }
