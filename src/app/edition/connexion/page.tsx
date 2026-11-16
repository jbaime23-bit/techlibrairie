// src/app/edition/connexion/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/validations";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { AUTH_SPACES } from "@/lib/auth-spaces";

export const metadata: Metadata = {
  title: "Connexion à l'espace auteur",
  robots: { index: false, follow: false },
};

export default async function EditionConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const sp = await searchParams;
  const space = AUTH_SPACES.edition;

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
      <p className="mt-1 text-sm text-slate-600">Accédez à votre espace auteur.</p>

      <div className="mt-6">
        <LoginForm callbackUrl={callbackUrl} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Pas encore d&apos;espace auteur ?{" "}
        <Link
          href={`${space.registerPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-semibold text-brand-700 hover:underline"
        >
          Le créer
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">
        Vous cherchez la boutique ?{" "}
        <Link href="/boutique" className="font-semibold text-teal-700 hover:underline">
          Aller à la boutique
        </Link>
      </p>
    </AuthShell>
  );
      }
