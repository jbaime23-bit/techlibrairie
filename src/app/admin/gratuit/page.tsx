// src/app/admin/gratuit/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import { FreeResourceForm } from "@/components/admin/free-resource-form";
import {
  deleteFreeResourceAction,
  toggleFreeResourceAction,
} from "@/app/admin/gratuit/actions";
import { FREE_WAIT_SECONDS } from "@/lib/free-resources";
import { formatDate, formatFileSize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "PDF gratuits",
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  bascule: "Statut de la ressource modifié.",
  supprime: "Ressource supprimée.",
};

export default async function AdminGratuitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/gratuit");

  const resources = await prisma.freeResource.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const messageKey = firstParam(sp.message);
  const message = messageKey ? MESSAGES[messageKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PDF gratuits</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ces PDF sont proposés gratuitement sur{" "}
          <Link href="/gratuit" className="font-semibold text-brand-700 hover:underline">
            la page des téléchargements gratuits
          </Link>
          . Le visiteur attend {FREE_WAIT_SECONDS} secondes, avec les publicités de l&apos;emplacement
          « confirmation de paiement et téléchargement », avant de pouvoir télécharger.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Publier un PDF gratuit</h2>
        <div className="mt-4">
          <FreeResourceForm />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">PDF publiés ({resources.length})</h2>

        {resources.length === 0 ? (
          <div className="card text-sm text-slate-600">Aucun PDF gratuit pour le moment.</div>
        ) : (
          <ul className="space-y-4">
            {resources.map((resource) => (
              <li key={resource.id} className="card">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-24 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                    {resource.coverImageUrl ? (
                      <Image
                        src={resource.coverImageUrl}
                        alt={`Couverture de ${resource.title}`}
                        width={72}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-400">PDF</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{resource.title}</p>
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                          resource.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {resource.isActive ? "Publié" : "Retiré"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatFileSize(resource.pdfSizeBytes)} · {resource.downloadCount}{" "}
                      téléchargement{resource.downloadCount > 1 ? "s" : ""} · ajouté le{" "}
                      {formatDate(resource.createdAt)}
                    </p>
                    {resource.isActive && (
                      <Link
                        href={`/gratuit/${resource.slug}`}
                        className="text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Voir la page publique
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={toggleFreeResourceAction}>
                    <input type="hidden" name="resourceId" value={resource.id} />
                    <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                      {resource.isActive ? "Retirer de la page" : "Republier"}
                    </button>
                  </form>

                  <form action={deleteFreeResourceAction}>
                    <input type="hidden" name="resourceId" value={resource.id} />
                    <button
                      type="submit"
                      className="btn-secondary px-3 py-1 text-xs text-red-700"
                    >
                      Supprimer définitivement
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Les publicités affichées pendant l&apos;attente se règlent dans{" "}
            <Link href="/admin/publicites" className="font-semibold text-brand-700 hover:underline">
              Publicités
            </Link>
            , emplacement « confirmation de paiement et téléchargement ».
          </li>
          <li>
            Les publicités de partenaires ne s&apos;affichent qu&apos;aux visiteurs qui ont accepté les
            cookies publicitaires ; l&apos;attente est la même pour tous.
          </li>
          <li>
            Le PDF est stocké en accès privé et n&apos;a pas d&apos;adresse publique. La suppression d&apos;une
            ressource efface aussi ses fichiers.
          </li>
          <li>
            Publiez uniquement des documents dont vous détenez les droits de diffusion.
          </li>
        </ul>
      </section>
    </div>
  );
}
