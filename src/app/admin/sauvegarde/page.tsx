// src/app/admin/sauvegarde/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import { BACKUP_DATASETS } from "@/lib/backup";
import { formatDateTime } from "@/lib/support";

export const metadata: Metadata = {
  title: "Sauvegarde de secours",
};

export const dynamic = "force-dynamic";

const REMINDER_DAYS = 35;

const ERRORS: Record<string, string> = {
  jeu: "Jeu de données inconnu.",
  limite: "Trop de téléchargements récents de ce fichier. Patientez 15 minutes.",
  "trop-de-lignes":
    "Ce jeu de données contient plus de 20 000 lignes : il ne peut pas être téléchargé en un seul fichier avec cet outil.",
  "trop-volumineux":
    "La sauvegarde complète dépasse la taille autorisée (environ 4 Mo). Téléchargez les fichiers un par un.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

export default async function AdminSauvegardePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/sauvegarde");

  const [counts, last] = await Promise.all([
    Promise.all(
      BACKUP_DATASETS.map(async (item) => ({
        key: item.key,
        count: await item.count().catch(() => null),
      }))
    ),
    prisma.auditLog.findFirst({
      where: { action: "sauvegarde.telechargee" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const countByKey = new Map(counts.map((entry) => [entry.key, entry.count]));
  const daysSince = last
    ? Math.floor((Date.now() - last.createdAt.getTime()) / 86_400_000)
    : null;
  const overdue = daysSince === null || daysSince > REMINDER_DAYS;

  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sauvegarde de secours</h1>
        <p className="mt-1 text-sm text-slate-600">
          Téléchargez une copie de vos données. Le plan gratuit de Neon ne conserve qu&apos;un
          historique très court (quelques heures d&apos;après sa page de tarifs, à vérifier) : une
          fausse manipulation ou une base endommagée serait sinon irrécupérable.
        </p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <section
        className={`card ${
          overdue ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"
        }`}
      >
        <p className="text-lg font-semibold">
          {last
            ? `Dernière sauvegarde téléchargée : ${formatDateTime(last.createdAt)} (il y a ${daysSince} jour${daysSince !== 1 ? "s" : ""}).`
            : "Aucune sauvegarde n'a encore été téléchargée."}
        </p>
        {overdue && (
          <p className="mt-1 text-sm text-yellow-900">
            Il est recommandé de télécharger une sauvegarde au moins une fois par mois, et avant
            toute modification importante.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Tout en un fichier</h2>
        <p className="mt-1 text-sm text-slate-600">
          Un seul fichier JSON contenant tous les jeux de données ci-dessous. C&apos;est le plus simple
          pour une sauvegarde régulière.
        </p>
        <div className="mt-4">
          {/* Lien classique (pas de préchargement) : chaque clic déclenche un téléchargement enregistré. */}
          <a href="/api/admin/sauvegarde?jeu=tout" className="btn-primary">
            Télécharger la sauvegarde complète
          </a>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Fichier par fichier (Excel)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Un fichier CSV par jeu de données, lisible dans Excel (séparateur point-virgule).
        </p>

        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {BACKUP_DATASETS.map((item) => {
            const count = countByKey.get(item.key);

            return (
              <li
                key={item.key}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">
                    {item.label}{" "}
                    <span className="font-normal text-slate-500">
                      ({count === null || count === undefined ? "?" : count} ligne
                      {count !== null && count !== undefined && count > 1 ? "s" : ""})
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
                <a
                  href={`/api/admin/sauvegarde?jeu=${item.key}`}
                  className="btn-secondary px-3 py-1 text-xs"
                >
                  Télécharger
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Jamais inclus</strong> : les mots de passe, les clés de double authentification,
            les jetons de connexion et de téléchargement, les empreintes de connexion et les
            coordonnées bancaires éventuelles.
          </li>
          <li>
            <strong>Les fichiers PDF et les images ne sont pas dans cette sauvegarde</strong> : ils
            sont stockés chez Vercel Blob. Le fichier « Ouvrages » contient seulement leurs noms, ce
            qui permet de les rattacher.
          </li>
          <li>
            <strong>Ces fichiers contiennent des données personnelles</strong> (noms, emails, téléphones,
            messages du support). Conservez-les dans un endroit protégé, ne les envoyez pas par
            messagerie, et supprimez-les de votre téléphone une fois copiés en lieu sûr.
          </li>
          <li>
            <strong>Il n&apos;existe pas encore d&apos;outil de restauration automatique.</strong> Ce
            fichier permet de reconstituer vos informations ; en cas de sinistre, il faudra écrire un
            script d&apos;import adapté.
          </li>
          <li>
            Dans les fichiers CSV, une cellule qui commence par =, +, - ou @ reçoit une apostrophe
            (protection contre l&apos;exécution de formules par Excel). Le fichier JSON n&apos;est pas
            modifié.
          </li>
          <li>
            Chaque téléchargement est enregistré dans le Journal. Au-delà de 20 000 lignes par jeu de
            données, l&apos;outil refuse le téléchargement.
          </li>
        </ul>
      </section>
    </div>
  );
}
