// src/app/(auth)/inscription/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Inscription",
};

export default async function InscriptionPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-lg">
        <div className="card">
          <h1 className="text-2xl font-bold">Créer un compte</h1>
          <p className="mt-1 text-sm text-slate-600">
            Rejoignez TechLibrairie comme acheteur ou comme vendeur.
          </p>

          <div className="mt-6">
            <RegisterForm />
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Déjà inscrit ?{" "}
            <Link
              href="/connexion"
              className="font-semibold text-brand-700 hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
