// src/app/admin/sante/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, requireAdmin } from "@/lib/admin";
import { runHealthChecks, type HealthStatus } from "@/lib/health";

export const metadata: Metadata = {
  title: "Santé du site",
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<HealthStatus, string> = {
  ok: "OK",
  warning: "Attention",
  error: "À corriger",
  info: "Info",
};

const STATUS_STYLES: Record<HealthStatus, string> = {
  ok: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  info: "bg-slate-100 text-slate-700",
};

const MANUAL_CHECKLIST: string[] = [
  "Faire un achat de test par Mobile Money (compte de test CinetPay), puis télécharger le PDF acheté.",
  "Si la carte est proposée : faire un achat de test par carte (carte de test Stripe 4242 4242 4242 4242 en mode test, ou carte de test CinetPay), puis télécharger le PDF.",
  "Créer un code promotionnel de test (Administration, Promotions), l'appliquer à un achat de test, puis vérifier le montant payé, la fiche de la commande et l'export comptable.",
  "Rembourser une commande de test depuis Administration, Commandes, et vérifier que les liens de téléchargement sont désactivés.",
  "Créer un compte vendeur de test, publier un PDF de plus de 5 Mo, modifier son prix, puis le retirer de la vente.",
  "Acheter puis noter un ouvrage avec un compte de test, puis masquer l'avis depuis Administration, Avis.",
  "Demander et traiter un versement de test (Versements).",
  "Vérifier la réception des emails dans une vraie boîte mail : confirmation d'achat, réponse du support, mot de passe oublié, changement d'adresse email.",
  "Recevoir le rapport mensuel (Administration, Rapports mensuels, « Me l'envoyer par email ») et la liste des alertes (Administration, Alertes, « Me l'envoyer maintenant »).",
  "Vérifier dans Vercel, Settings, Cron Jobs, que les deux tâches planifiées sont listées (3 h et 16 h UTC), puis qu'elles apparaissent ci-dessus avec une dernière exécution de moins de 36 heures.",
  "Activer la double authentification de chaque administrateur et noter les codes de secours dans un endroit sûr.",
  "Passer Stripe en mode production (clé « live », nouveau webhook et son nouveau secret) si vous l'utilisez, et passer CinetPay en production.",
  "Faire relire les conditions générales, les mentions légales et la politique de confidentialité par un juriste.",
  "Renseigner LEGAL_NAME et LEGAL_ADDRESS, puis supprimer SETUP_SECRET dans Vercel (et RESET_2FA_EMAIL si elle existe).",
  "Associer votre nom de domaine à Vercel, puis mettre à jour NEXT_PUBLIC_APP_URL et NEXTAUTH_URL avec la nouvelle adresse.",
  "Vérifier dans Neon que les sauvegardes sont activées et connaître la procédure de restauration. Si vous changez de plan, définir DB_STORAGE_LIMIT_MB.",
  "Supprimer les données de test (commandes, utilisateurs, ouvrages fictifs, codes promotionnels et avis de test) avant l'ouverture.",
  "Lancer une analyse à blanc depuis Administration, Maintenance.",
];

export default async function AdminSantePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/sante");

  const liveTests = firstParam(sp.tests) === "1";
  const sections = await runHealthChecks({ liveTests });

  const allChecks = sections.flatMap((section) => section.checks);
  const errors = allChecks.filter((item) => item.status === "error").length;
  const warnings = allChecks.filter((item) => item.status === "warning").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Santé du site</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vérification de la configuration, de la base de données et des tâches automatiques.
          Aucune valeur secrète n&apos;est affichée.
        </p>
      </div>

      <section
        className={`card ${
          errors > 0
            ? "border-red-200 bg-red-50"
            : warnings > 0
              ? "border-yellow-200 bg-yellow-50"
              : "border-green-200 bg-green-50"
        }`}
      >
        <p className="text-lg font-semibold">
          {errors === 0 && warnings === 0
            ? "Tout est en ordre."
            : `${errors} point(s) à corriger, ${warnings} avertissement(s).`}
        </p>

        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/admin/sante" className="btn-secondary">
            Relancer les vérifications
          </Link>
          <Link href="/admin/sante?tests=1" className="btn-secondary">
            Lancer aussi les tests de connexion (Stripe, stockage)
          </Link>
          <Link href="/admin/alertes" className="btn-secondary">
            Voir les alertes
          </Link>
        </div>
        {!liveTests && (
          <p className="mt-2 text-xs text-slate-600">
            Les tests de connexion appellent réellement Stripe et le stockage : ils
            sont plus lents, d&apos;où ce bouton séparé.
          </p>
        )}
      </section>

      {sections.map((section) => (
        <section key={section.title} className="card">
          <h2 className="text-lg font-semibold">{section.title}</h2>

          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {section.checks.map((item) => (
              <li key={`${section.title}-${item.label}`} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{item.label}</p>
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[item.status]}`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>
                <p className="mt-1 break-words text-slate-600">{item.detail}</p>
                {item.fix && (
                  <p className="mt-1 break-words text-xs text-slate-500">
                    À faire : {item.fix}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="card">
        <h2 className="text-lg font-semibold">Liste de contrôle avant l&apos;ouverture au public</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ces points ne peuvent pas être vérifiés automatiquement : à faire vous-même.
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          {MANUAL_CHECKLIST.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
                }
