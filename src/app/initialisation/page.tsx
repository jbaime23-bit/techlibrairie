// src/app/initialisation/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { hasAdmin } from "@/lib/bootstrap";
import { SetupForm } from "@/components/initialisation/setup-form";

export const metadata: Metadata = {
  title: "Initialisation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InitialisationPage() {
  const secretConfigured = Boolean(
    process.env.SETUP_SECRET && process.env.SETUP_SECRET.length >= 16
  );

  let alreadyDone = false;
  let databaseError = false;

  try {
    alreadyDone = await hasAdmin();
  } catch (error) {
    console.error("Initialisation : base de données inaccessible :", error);
    databaseError = true;
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-lg">
        <div className="card">
          <h1 className="text-2xl font-bold">Initialisation de TechLibrairie</h1>

          {databaseError ? (
            <div className="alert-error mt-4">
              La base de données est inaccessible. Vérifiez la variable
              DATABASE_URL dans Vercel et que le dernier déploiement a bien
              créé les tables.
            </div>
          ) : alreadyDone ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-600">
                La plateforme est déjà initialisée. Cette page est verrouillée.
              </p>
              <Link href="/connexion" className="btn-primary w-full">
                Aller à la connexion
              </Link>
            </div>
          ) : !secretConfigured ? (
            <div className="alert-error mt-4">
              Ajoutez dans Vercel la variable d&apos;environnement SETUP_SECRET
              (au moins 16 caractères aléatoires), puis redéployez le projet.
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-6 text-sm text-slate-600">
                Créez le compte administrateur et préparez la plateforme
                (catégories, paramètres, emplacements publicitaires). Cette
                opération n&apos;est possible qu&apos;une seule fois.
              </p>
              <SetupForm />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
