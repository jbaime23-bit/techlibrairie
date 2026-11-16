// src/app/boutique/[espace]/inscription/page.tsx
// Inscription à la boutique : espace acheteur ou vendeur.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/validations";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { AUTH_SPACES, isSpaceKey } from "@/lib/auth-spaces";

export const metadata: Metadata = {
  title: "Inscription à la boutique",
  robots: { index: false, follow: false },
};

export default async function BoutiqueInscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ espace: string }>;
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { espace } = await params;
  const sp = await searchParams;

  if (!isSpaceKey(espace) || espace === "edition") {
    notFound();
  }

  const space = AUTH_SPACES[espace];
  const other = espace === "acheteur" ? AUTH_SPACES.vendeur : AUTH_SPACES.acheteur;

  const callbackUrl = safeCallbackUrl(sp.callbackUrl, space.defaultCallback);
  const user = await getCurrentUser();

  if (user) {
    redirect(callbackUrl);
  }

  return (
    <AuthShell
      tone={space.tone}
      title={space.registerTitle}
      subtitle={space.registerSubtitle}
      perks={space.perks}
    >
      <h2 className="text-2xl font-bold">Inscription</h2>
      <p className="mt-1 text-sm text-slate-600">Quelques informations suffisent.</p>

      <div className="mt-6">
        <RegisterForm
          fixedType={space.accountType}
          redirectTo={callbackUrl}
          displayNameLabel={space.displayNameLabel}
          sellerNote={space.sellerNote}
          submitLabel={space.submitLabel}
        />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Déjà un compte {espace} ?{" "}
        <Link
          href={`${space.loginPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-semibold text-teal-700 hover:underline"
        >
          Me connecter
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">
        Vous êtes plutôt {espace === "acheteur" ? "vendeur" : "acheteur"} ?{" "}
        <Link href={other.registerPath} className="font-semibold text-teal-700 hover:underline">
          {other.registerTitle}
        </Link>
      </p>
    </AuthShell>
  );
}
