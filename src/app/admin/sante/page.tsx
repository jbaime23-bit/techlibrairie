// src/app/admin/sante/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, requireAdmin } from "@/lib/admin";
import { buildHealthReport, type HealthStatus } from "@/lib/health";

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
  "Faire un achat de test par carte (carte de test Stripe 4242 4242 4242 4242 en mode test), puis télécharger le PDF acheté.",
  "Faire un achat de test par Mobile Money (compte de test CinetPay), puis télécharger le PDF.",
  "Rembourser une commande de test depuis Administration, Commandes, et vérifier que les liens de téléchargement sont désactivés.",
  "Créer un compte vendeur de test, publier un PDF de plus de 5 Mo, modifier son prix, puis le retirer de la vente.",
  "Demander et traiter un versement de test (Versements).",
  "Vérifier la réception des emails (confirmation d'achat, réponse du support, mot de passe oublié) dans une vraie boîte mail.",
  "Passer Stripe en mode production : clé « live », nouveau webhook et son nouveau secret. Passer CinetPay en production.",
  "Faire relire les conditions générales, les mentions légales et la politique de confidentialité par un juriste.",
  "Renseigner LEGAL_NAME et LEGAL_ADDRESS, puis supprimer SETUP_SECRET dans Vercel.",
  "Associer votre nom de domaine à Vercel, puis mettre à jour NEXT_PUBLIC_APP_URL et NEXTAUTH_URL avec la nouvelle adresse.",
  "Vérifier dans Neon que les sauvegardes sont activées et connaître la procédure de restauration.",
  "Supprimer les données de test (commandes, utilisateurs, ouvrages fictifs) avant l'ouverture.",
  "Lancer une analyse à blanc depuis Administration, Maintenance.",
];

export default async function AdminSantePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  await requireAdmin("/admin/sante");

  // On utilise la vraie fonction buildHealthReport de votre projet
  const sections = await buildHealthReport();

  const allChecks = sections.flatMap((section) => section.checks);
  const errors = allChecks.filter((item) => item.status === "error").length;
  const warnings = allChecks.filter((item) => item.status === "warning").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Santé du site</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vérification de la configuration avant la mise en ligne. Aucune valeur
          secrète n&apos;est affichée.
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
        </div>
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
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[item.status as HealthStatus] || "bg-slate-100"}`}
                  >
                    {STATUS_LABELS[item.status as HealthStatus] || item.status}
                  </span>
                </div>
                <p className="mt-1 break-words text-slate-600">{item.detail}</p>
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
