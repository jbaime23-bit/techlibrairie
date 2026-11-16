// src/app/boutique/[espace]/connexion/page.tsx
// Connexion à la boutique : espace acheteur (/boutique/acheteur/connexion) ou vendeur (/boutique/vendeur/connexion).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/validations";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { AUTH_SPACES, isSpaceKey } from "@/lib/auth-spaces";

export const metadata: Metadata = {
  title: "Connexion à la boutique",
  robots: { index: false, follow: false },
};

export default async function BoutiqueConnexionPage({
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
      title={space.loginTitle}
      subtitle={space.loginSubtitle}
      perks={space.perks}
    >
      <h2 className="text-2xl font-bold">Connexion</h2>
      <p className="mt-1 text-sm text-slate-600">Accédez à votre {space.label.toLowerCase()}.</p>

      <div className="mt-6">
        <LoginForm callbackUrl={callbackUrl} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Pas encore de compte ?{" "}
        <Link
          href={`${space.registerPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-semibold text-teal-700 hover:underline"
        >
          Créer un compte {espace}
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">
        Vous êtes plutôt {espace === "acheteur" ? "vendeur" : "acheteur"} ?{" "}
        <Link href={other.loginPath} className="font-semibold text-teal-700 hover:underline">
          {other.label}
        </Link>
      </p>
    </AuthShell>
  );
}
