// src/app/admin/maintenance/page.tsx
import type { Metadata } from "next";
import { firstParam, requireAdmin } from "@/lib/admin";
import { runMaintenanceAction } from "@/app/admin/maintenance/actions";

export const metadata: Metadata = {
  title: "Maintenance",
};

export const dynamic = "force-dynamic";

function count(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(firstParam(value) ?? "0", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const SCAN_LABELS: Record<string, string> = {
  ok: "Analyse complète",
  partiel: "Analyse partielle (temps imparti atteint : le reste sera traité à la prochaine exécution)",
  indisponible: "Analyse impossible (voir les journaux Vercel)",
};

export default async function AdminMaintenancePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin("/admin/maintenance");

  const cronConfigured = Boolean(
    process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16
  );

  const mode = firstParam(searchParams.mode);
  const hasReport = mode === "blanc" || mode === "reel";
  const isDryRun = mode === "blanc";
  const error = firstParam(searchParams.erreur);

  const scan = firstParam(searchParams.sc) ?? "ok";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Maintenance</h1>

      {error === "confirmation" && (
        <div className="alert-error">Cochez la case de confirmation pour lancer le nettoyage.</div>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Maintenance automatique</h2>

        <p className="mt-2 text-sm text-slate-600">
          Tâche planifiée quotidienne :{" "}
          <strong className={cronConfigured ? "text-green-700" : "text-red-700"}>
            {cronConfigured ? "activée" : "désactivée (CRON_SECRET manquant dans Vercel)"}
          </strong>
          . Elle s&apos;exécute chaque jour vers 3 h (heure UTC).
        </p>

        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            Annule les commandes en attente depuis plus de 48 heures, après avoir revérifié leur paiement
            auprès de Stripe ou CinetPay.
          </li>
          <li>Supprime les conversations de support jamais payées depuis plus de 14 jours.</li>
          <li>
            Supprime les fichiers PDF orphelins (envoyés mais rattachés à aucun produit) depuis plus de 7
            jours.
          </li>
          <li>
            Supprime les jetons expirés, les échecs de connexion de plus de 24 heures et les liens de
            téléchargement expirés depuis plus de 30 jours.
          </li>
        </ul>
      </section>

      {hasReport && (
        <section className="card border-brand-200 bg-brand-50">
          <h2 className="text-lg font-semibold">
            {isDryRun ? "Résultat de l'analyse (rien n'a été modifié)" : "Résultat du nettoyage"}
          </h2>

          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>{isDryRun ? "Commandes abandonnées à annuler" : "Commandes abandonnées annulées"}</dt>
              <dd className="font-semibold">{count(searchParams.oc)}</dd>
            </div>
            {!isDryRun && (
              <div className="flex justify-between gap-4">
                <dt>Commandes finalement payées (rattrapées)</dt>
                <dd className="font-semibold">{count(searchParams.or)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt>
                {isDryRun
                  ? "Conversations de support non payées à supprimer"
                  : "Conversations de support non payées supprimées"}
              </dt>
              <dd className="font-semibold">{count(searchParams.st)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{isDryRun ? "Jetons expirés à supprimer" : "Jetons expirés supprimés"}</dt>
              <dd className="font-semibold">{count(searchParams.tk)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>
                {isDryRun
                  ? "Anciens échecs de connexion à supprimer"
                  : "Anciens échecs de connexion supprimés"}
              </dt>
              <dd className="font-semibold">{count(searchParams.la)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>
                {isDryRun
                  ? "Anciens liens de téléchargement à supprimer"
                  : "Anciens liens de téléchargement supprimés"}
              </dt>
              <dd className="font-semibold">{count(searchParams.dt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>PDF orphelins trouvés</dt>
              <dd className="font-semibold">{count(searchParams.of)}</dd>
            </div>
            {!isDryRun && (
              <div className="flex justify-between gap-4">
                <dt>PDF orphelins supprimés</dt>
                <dd className="font-semibold">{count(searchParams.od)}</dd>
              </div>
            )}
          </dl>

          <p className="mt-3 text-xs text-slate-600">
            {SCAN_LABELS[scan] ?? SCAN_LABELS.ok} · durée : {count(searchParams.ms)} ms
            {firstParam(searchParams.ex) === "1"
              ? " · temps imparti atteint : relancez pour traiter la suite"
              : ""}
          </p>
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Lancer à la demande</h2>

        <div className="mt-4 space-y-6">
          <form action={runMaintenanceAction} className="space-y-2">
            <input type="hidden" name="mode" value="blanc" />
            <p className="text-sm text-slate-600">
              L&apos;analyse montre ce qui serait traité, sans rien modifier ni supprimer. Faites-la avant
              le premier nettoyage réel.
            </p>
            <button type="submit" className="btn-secondary">
              Analyser (sans rien supprimer)
            </button>
          </form>

          <form action={runMaintenanceAction} className="space-y-3 border-t border-slate-100 pt-6">
            <input type="hidden" name="mode" value="run" />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
              <span>
                Je confirme le nettoyage réel. Les suppressions de conversations et de fichiers PDF
                orphelins sont définitives.
              </span>
            </label>
            <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700">
              Lancer le nettoyage
            </button>
          </form>
        </div>
      </section>
    </div>
  );
            }
