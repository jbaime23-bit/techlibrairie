// src/app/profil/email/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { isEmailConfigured } from "@/lib/email";
import { maskEmail } from "@/lib/account-emails";
import { requestEmailChangeAction } from "@/app/profil/email/actions";

export const metadata: Metadata = {
  title: "Changer mon adresse email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  email: "Adresse email invalide.",
  identique: "Cette adresse est déjà celle de votre compte.",
  utilisee: "Cette adresse est déjà utilisée par un autre compte.",
  "mot-de-passe": "Mot de passe incorrect.",
  code: "Code de double authentification incorrect.",
  limite: "Trop de tentatives ou de demandes récentes. Patientez avant de réessayer.",
  envoi: "L'email de confirmation n'a pas pu être envoyé. Vérifiez l'adresse puis réessayez.",
  indisponible:
    "Le changement d'adresse est momentanément indisponible (envoi d'emails non configuré). Contactez le support.",
  lien: "Ce lien de confirmation est invalide, expiré, ou ne correspond pas au compte connecté.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

export default async function ChangerEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const user = await requireUser("/profil/email");
  const needsCode = user.role === "ADMIN" && Boolean(user.totpEnabledAt);
  const emailReady = isEmailConfigured();

  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;
  const sent = firstParam(sp.message) === "envoye";
  const recipient = firstParam(sp.destinataire);

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/profil"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Retour à mon profil
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Changer mon adresse email</h1>
          <p className="mt-1 text-sm text-slate-600">
            Adresse actuelle : <strong>{user.email}</strong>
          </p>
        </div>

        {sent && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Un email de confirmation vient d&apos;être envoyé à{" "}
            <strong>{recipient ? maskEmail(recipient) : "la nouvelle adresse"}</strong>. Cliquez sur le
            lien qu&apos;il contient dans l&apos;heure pour valider le changement. Votre adresse actuelle
            reste inchangée tant que vous n&apos;avez pas confirmé.
          </div>
        )}

        {error && <div className="alert-error">{error}</div>}

        {!emailReady && (
          <div className="alert-error">
            L&apos;envoi d&apos;emails n&apos;est pas configuré sur ce site : le changement d&apos;adresse est
            indisponible pour le moment.
          </div>
        )}

        <section className="card">
          <form action={requestEmailChangeAction} className="space-y-4">
            <div>
              <label htmlFor="newEmail" className="label">
                Nouvelle adresse email
              </label>
              <input
                id="newEmail"
                name="newEmail"
                type="email"
                autoComplete="email"
                required
                className="input"
                disabled={!emailReady}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Votre mot de passe (pour confirmer que c&apos;est bien vous)
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                disabled={!emailReady}
              />
            </div>

            {needsCode && (
              <div>
                <label htmlFor="code" className="label">
                  Code à 6 chiffres de votre application d&apos;authentification
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  autoComplete="one-time-code"
                  maxLength={20}
                  required
                  className="input max-w-[14rem]"
                  disabled={!emailReady}
                />
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={!emailReady}>
              Envoyer le lien de confirmation
            </button>
          </form>
        </section>

        <section className="card text-sm text-slate-600">
          <h2 className="text-lg font-semibold text-slate-900">Comment ça marche</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Nous envoyons un lien de confirmation à la <strong>nouvelle</strong> adresse, valable 1 heure.
            </li>
            <li>
              Votre <strong>ancienne</strong> adresse reçoit une alerte : si ce n&apos;est pas vous,
              elle vous permet de réagir.
            </li>
            <li>
              Après confirmation, vous vous connecterez avec la nouvelle adresse. Vos commandes et vos
              achats ne changent pas.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
    }
