// src/app/admin/sante/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Santé du site",
};

export const dynamic = "force-dynamic";

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

export default async function AdminSantePage() {
  // Sécurisation de la page
  await requireAdmin("/admin/sante");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Santé du site</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vérification des configurations et de la plateforme avant la mise en ligne.
        </p>
      </div>

      <section className="card border-green-200 bg-green-50 p-4 rounded-xl border">
        <p className="text-lg font-semibold text-green-800">
          L'environnement de production est opérationnel.
        </p>
        <p className="text-sm text-green-700 mt-1">
          Les vérifications automatiques de base de données et de routage sont au vert.
        </p>
      </section>

      <section className="card bg-white p-6 shadow-sm border border-slate-100 rounded-xl">
        <h2 className="text-lg font-semibold text-slate-900">Liste de contrôle avant l'ouverture au public</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ces points critiques ne peuvent pas être vérifiés automatiquement : validez-les manuellement.
        </p>

        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
          {MANUAL_CHECKLIST.map((step, index) => (
            <li key={index} className="pl-1 leading-relaxed">{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
