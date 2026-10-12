// src/components/legal/legal-page.tsx
// Mise en page commune des pages légales.
// Le bandeau d'avertissement n'est visible que par l'administrateur.

import { getCurrentUser } from "@/lib/auth";
import {
  LEGAL_UPDATED_AT,
  getLegalConfig,
  missingLegalFields,
} from "@/lib/legal-config";

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

export default async function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";
  const missing = isAdmin ? missingLegalFields(getLegalConfig()) : [];

  return (
    <div className="container-page py-8">
      <article className="mx-auto max-w-3xl">
        {isAdmin && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            <p className="font-semibold">Message visible par les administrateurs uniquement</p>
            <p className="mt-1">
              Ce texte est un modèle de départ : faites-le relire par un juriste avant
              l&apos;ouverture au public.
            </p>
            {missing.length > 0 && (
              <>
                <p className="mt-2">
                  Informations d&apos;éditeur encore à renseigner dans Vercel (Environment
                  Variables) :
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {missing.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Dernière mise à jour : {LEGAL_UPDATED_AT}</p>

        {children}
      </article>
    </div>
  );
        }
