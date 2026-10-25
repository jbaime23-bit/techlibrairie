// src/app/gratuit/[slug]/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getConsent } from "@/lib/consent";
import AdSlot from "@/components/publicite/AdSlot";
import { CookieSettingsButton } from "@/components/legal/cookie-settings-button";
import { DownloadGate } from "@/components/gratuit/download-gate";
import {
  FREE_LINK_MAX_AGE_SECONDS,
  FREE_WAIT_SECONDS,
  createWaitToken,
} from "@/lib/free-resources";
import { formatDate, formatFileSize } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
};

const ERRORS: Record<string, string> = {
  lien: "Ce lien de téléchargement est invalide. Patientez sur cette page pour en obtenir un nouveau.",
  attente: "Le téléchargement n'est disponible qu'après l'attente de 30 secondes.",
  expire: "Ce lien a expiré. Rechargez la page pour recommencer.",
  fichier: "Le fichier est momentanément introuvable. Réessayez plus tard.",
  limite: "Trop de téléchargements récents de ce fichier. Réessayez dans quelques minutes.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resource = await prisma.freeResource.findUnique({
    where: { slug },
    select: { title: true, description: true, isActive: true },
  });

  if (!resource || !resource.isActive) {
    return { title: "PDF introuvable" };
  }

  return {
    title: `${resource.title} (PDF gratuit)`,
    description: resource.description.slice(0, 160),
  };
}

export default async function GratuitResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erreur?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const resource = await prisma.freeResource.findUnique({ where: { slug } });

  if (!resource || !resource.isActive) {
    notFound();
  }

  // Jeton signé : le serveur n'acceptera le téléchargement qu'après 30 secondes.
  const token = createWaitToken(resource.id);
  const consent = await getConsent();

  const errorKey = Array.isArray(query.erreur) ? query.erreur[0] : query.erreur;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="container-page py-8">
      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/gratuit" className="hover:text-brand-700">
          Téléchargements gratuits
        </Link>
      </nav>

      {error && <div className="alert-error mb-6">{error}</div>}

      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {resource.coverImageUrl ? (
            <Image
              src={resource.coverImageUrl}
              alt={`Couverture de ${resource.title}`}
              width={260}
              height={347}
              priority
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-4xl font-bold text-slate-300">PDF</span>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{resource.title}</h1>
            <p className="mt-1 text-sm font-semibold text-green-700">Gratuit</p>
          </div>

          <dl className="grid max-w-md grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Format</dt>
            <dd>PDF ({formatFileSize(resource.pdfSizeBytes)})</dd>

            <dt className="text-slate-500">Langue</dt>
            <dd>{LANGUAGE_LABELS[resource.language] ?? resource.language}</dd>

            {resource.pageCount && (
              <>
                <dt className="text-slate-500">Pages</dt>
                <dd>{resource.pageCount}</dd>
              </>
            )}

            <dt className="text-slate-500">Publié le</dt>
            <dd>{formatDate(resource.createdAt)}</dd>
          </dl>

          <p className="whitespace-pre-line text-slate-700">{resource.description}</p>

          <AdSlot placement="DOWNLOAD_CONFIRMATION" />

          <DownloadGate
            slug={resource.slug}
            token={token}
            waitSeconds={FREE_WAIT_SECONDS}
            maxAgeSeconds={FREE_LINK_MAX_AGE_SECONDS}
            sizeLabel={formatFileSize(resource.pdfSizeBytes)}
          />

          {consent !== "granted" && (
            <p className="text-xs text-slate-500">
              Les publicités de partenaires ne s&apos;affichent que si vous avez accepté les cookies
              publicitaires. L&apos;attente reste de {FREE_WAIT_SECONDS} secondes dans tous les cas. Vous
              pouvez changer votre choix :{" "}
              <span className="font-semibold text-brand-700 underline">
                <CookieSettingsButton />
              </span>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
  }
