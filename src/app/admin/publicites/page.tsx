// src/app/admin/publicites/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { AdForm } from "@/components/admin/ad-form";
import { deleteAdAction, toggleAdActiveAction } from "@/app/admin/actions";
import { adKindLabel, adPlacementLabel } from "@/lib/ad-options";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Publicités",
};

export const dynamic = "force-dynamic";

export default async function AdminPublicitesPage() {
  await requireAdmin("/admin/publicites");

  const ads = await prisma.adSpace.findMany({
    orderBy: [{ placement: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Publicités</h1>

      <section className="card">
        <h2 className="text-lg font-semibold">Ajouter une publicité</h2>
        <p className="mt-1 text-sm text-slate-600">
          Créez une bannière pour une entreprise tierce ou un emplacement
          Adsterra. Elle est affichée immédiatement (délai maximum d&apos;une
          minute).
        </p>
        <div className="mt-6">
          <AdForm />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Publicités existantes ({ads.length})</h2>

        {ads.length === 0 ? (
          <div className="card mt-4 text-sm text-slate-600">
            Aucune publicité. Elles sont créées à l&apos;initialisation de la
            plateforme.
          </div>
        ) : (
          <div className="card mt-4 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Publicité</th>
                  <th className="px-4 py-3 font-medium">Emplacement</th>
                  <th className="px-4 py-3 font-medium">Vues / clics</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => {
                  const isLocal = ad.kind === "LOCAL_BANNER";
                  const ctr =
                    ad.impressions > 0
                      ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)} %`
                      : "-";

                  return (
                    <tr key={ad.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{ad.name}</p>
                        <p className="text-xs text-slate-500">{adKindLabel(ad.kind)}</p>
                        {isLocal && ad.advertiserName && (
                          <p className="text-xs text-slate-500">
                            Annonceur : {ad.advertiserName}
                          </p>
                        )}
                        {isLocal && ad.priceAmountXof !== null && (
                          <p className="text-xs text-slate-500">
                            Prix : {formatPrice(ad.priceAmountXof, "XOF")}
                          </p>
                        )}
                        {isLocal && (ad.startsAt || ad.endsAt) && (
                          <p className="text-xs text-slate-400">
                            {ad.startsAt ? `Du ${formatDate(ad.startsAt)}` : ""}
                            {ad.endsAt ? ` au ${formatDate(ad.endsAt)}` : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {adPlacementLabel(ad.placement)}
                        <p className="text-slate-400">Priorité {ad.priority}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isLocal ? (
                          <>
                            <p>
                              {ad.impressions} vues / {ad.clicks} clics
                            </p>
                            <p className="text-slate-400">Taux de clic : {ctr}</p>
                          </>
                        ) : (
                          <p className="text-slate-400">Suivi dans Adsterra</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                            ad.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ad.isActive ? "Active" : "Désactivée"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <form action={toggleAdActiveAction}>
                            <input type="hidden" name="adId" value={ad.id} />
                            <button
                              type="submit"
                              className="btn-secondary px-3 py-1 text-xs"
                            >
                              {ad.isActive ? "Désactiver" : "Activer"}
                            </button>
                          </form>
                          <form action={deleteAdAction}>
                            <input type="hidden" name="adId" value={ad.id} />
                            <button
                              type="submit"
                              className="btn-secondary px-3 py-1 text-xs text-red-700"
                            >
                              Supprimer
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
                    }
