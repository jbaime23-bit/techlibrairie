// src/app/(auth)/mot-de-passe-oublie/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
};

export default function MotDePasseOubliePage() {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md">
        <div className="card">
          <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-slate-600">
            Saisissez l&apos;adresse email de votre compte : nous vous envoyons un
            lien pour choisir un nouveau mot de passe.
          </p>

          <div className="mt-6">
            <ForgotPasswordForm />
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            <Link
              href="/connexion"
              className="font-semibold text-brand-700 hover:underline"
            >
              Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
