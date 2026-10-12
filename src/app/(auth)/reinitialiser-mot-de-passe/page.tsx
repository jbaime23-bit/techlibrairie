// src/app/(auth)/reinitialiser-mot-de-passe/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { findValidToken } from "@/lib/account-tokens";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReinitialiserMotDePassePage({
  searchParams,
}: {
  searchParams: { token?: string | string[] };
}) {
  const rawToken = Array.isArray(searchParams.token)
    ? searchParams.token[0]
    : searchParams.token;

  // Le lien est seulement vérifié ici : il n'est consommé qu'à l'enregistrement du mot de passe.
  const valid = rawToken ? await findValidToken("reset", rawToken) : null;

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md">
        <div className="card">
          <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>

          {valid && rawToken ? (
            <div className="mt-6">
              <ResetPasswordForm token={rawToken} />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="alert-error">
                Ce lien est invalide ou a expiré. Les liens de réinitialisation
                sont valables 1 heure et ne peuvent servir qu&apos;une fois.
              </div>
              <Link href="/mot-de-passe-oublie" className="btn-primary w-full">
                Faire une nouvelle demande
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
