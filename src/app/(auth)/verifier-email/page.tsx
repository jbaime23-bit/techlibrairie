// src/app/(auth)/verifier-email/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteTokensFor, findValidToken } from "@/lib/account-tokens";
import { resendVerificationEmailAction } from "@/app/(auth)/verifier-email/actions";

export const metadata: Metadata = {
  title: "Vérification de l'adresse email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  envoye: "Un email de vérification vient de vous être envoyé. Le lien est valable 24 heures.",
  deja: "Votre adresse email est déjà vérifiée.",
};

const ERRORS: Record<string, string> = {
  indisponible:
    "L'envoi d'emails est momentanément indisponible. Réessayez plus tard ou contactez le support.",
  limite: "Trop de demandes. Patientez 15 minutes avant de renvoyer l'email.",
  envoi: "L'email n'a pas pu être envoyé. Réessayez dans un instant.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VerifierEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const rawToken = firstValue(sp.token);

  // Cas 1 : l'utilisateur arrive depuis le lien reçu par email.
  if (rawToken) {
    const valid = await findValidToken("verify", rawToken);

    if (valid) {
      await prisma.user.updateMany({
        where: { email: valid.email, emailVerified: null },
        data: { emailVerified: new Date() },
      });
      await deleteTokensFor("verify", valid.email);
    }

    return (
      <div className="container-page py-12">
        <div className="mx-auto max-w-md">
          <div className="card">
            {valid ? (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold text-green-700">Adresse vérifiée</h1>
                <p className="text-sm text-slate-600">
                  Merci : votre adresse email est confirmée.
                </p>
                <Link href="/acheteur" className="btn-primary w-full">
                  Aller à mon espace
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">Lien invalide</h1>
                <div className="alert-error">
                  Ce lien de vérification est invalide ou a expiré (il est
                  valable 24 heures).
                </div>
                <Link href="/verifier-email" className="btn-primary w-full">
                  Recevoir un nouveau lien
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Cas 2 : l'utilisateur connecté vérifie son statut ou demande un nouvel email.
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent("/verifier-email")}`);
  }

  const messageKey = firstValue(sp.message);
  const errorKey = firstValue(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md">
        <div className="card space-y-4">
          <h1 className="text-2xl font-bold">Vérification de l&apos;adresse email</h1>

          {message && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {message}
            </div>
          )}
          {error && <div className="alert-error">{error}</div>}

          {user.emailVerified ? (
            <>
              <p className="text-sm text-slate-600">
                Votre adresse <strong>{user.email}</strong> est vérifiée.
              </p>
              <Link href="/acheteur" className="btn-primary w-full">
                Aller à mon espace
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Votre adresse <strong>{user.email}</strong> n&apos;est pas encore
                vérifiée. Cliquez ci-dessous pour recevoir un email contenant un
                lien de confirmation.
              </p>
              <form action={resendVerificationEmailAction}>
                <button type="submit" className="btn-primary w-full">
                  Envoyer l&apos;email de vérification
                </button>
              </form>
              <p className="text-xs text-slate-500">
                Pensez à vérifier vos courriers indésirables. La vérification est
                facultative : vous pouvez utiliser le site sans l&apos;avoir faite.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
                }
