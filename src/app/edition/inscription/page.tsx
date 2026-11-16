// src/app/edition/inscription/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/validations";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { AUTH_SPACES } from "@/lib/auth-spaces";

export const metadata: Metadata = {
  title: "Créer mon espace auteur",
  robots: { index: false, follow: false },
};

export default async function EditionInscriptionPage({
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
        Déjà un espace auteur ?{" "}
        <Link
          href={`${space.loginPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-semibold text-brand-700 hover:underline"
        >
          Me connecter
        </Link>
      </p>
    </AuthShell>
  );
}
