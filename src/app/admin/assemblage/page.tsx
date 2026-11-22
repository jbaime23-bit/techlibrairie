// src/app/admin/assemblage/page.tsx
// Module d'assemblage éditeur : liste des dossiers à assembler et module (administrateur connecté).
// Un dossier s'ouvre par ?projet=<livre à compte d'auteur> ou ?manuscrit=<manuscrit retenu>.
import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, requireAdmin } from "@/lib/admin";
import { AssemblyStudio } from "@/components/admin/assembly/assembly-studio";
import { listAssemblyDossiers, loadAssemblyDossier } from "@/lib/assembly/dossier-loader";

export const metadata: Metadata = {
  title: "Assemblage éditeur",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AssemblagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/assemblage");

  const projectId = firstParam(sp.projet);
  const manuscriptId = firstParam(sp.manuscrit);

  const dossier = projectId
    ? await loadAssemblyDossier("projet", projectId)
    : manuscriptId
      ? await loadAssemblyDossier("manuscrit", manuscriptId)
      : null;

  const requested = Boolean(projectId || manuscriptId);
  const dossiers = dossier ? [] : await listAssemblyDossiers();

  return (
    <div className="space-y-8">
      {requested && !dossier && (
        <div className="alert-error mx-auto max-w-3xl">
          Dossier introuvable. Choisissez-en un dans la liste ci-dessous.
        </div>
      )}

      {!dossier && (
        <section className="card mx-auto max-w-3xl">
          <h2 className="text-lg font-extrabold">Dossiers à assembler</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ouvrir un dossier pré-remplit le module : informations, couverture et photo de l&apos;auteur. Pour un
            livre à compte d&apos;auteur, vous pouvez ensuite envoyer l&apos;épreuve directement. Sans dossier, le module
            fonctionne aussi seul, plus bas.
          </p>

          {dossiers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              Aucun dossier pour le moment : il en apparaît un quand un forfait d&apos;édition est validé ou qu&apos;un
              manuscrit est retenu.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {dossiers.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.author} · {item.label} · {item.detail}
                    </p>
                  </div>
                  <Link
                    href={`/admin/assemblage?${item.kind === "projet" ? "projet" : "manuscrit"}=${item.id}`}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    Ouvrir le dossier
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <AssemblyStudio key={dossier ? `${dossier.kind}-${dossier.id}` : "libre"} dossier={dossier} />
    </div>
  );
                  }
