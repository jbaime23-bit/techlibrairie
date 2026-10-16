// src/app/admin/effacement/page.tsx
import type { Metadata } from "next";
import { firstParam, requireAdmin } from "@/lib/admin";
import { eraseAccountByAdminAction } from "@/app/admin/effacement/actions";

export const metadata: Metadata = {
  title: "Effacement d'un compte",
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  efface: "Compte effacé : ses données personnelles ont été supprimées ou anonymisées.",
};

const ERRORS: Record<string, string> = {
  email: "Adresse email invalide.",
  confirmation: "Cochez la case de confirmation et saisissez le mot EFFACER.",
  limite: "Trop de tentatives échouées. Patientez 15 minutes avant de réessayer.",
  "mot-de-passe": "Votre mot de passe est incorrect.",
  code: "Votre code de double authentification est incorrect.",
  introuvable: "Aucun compte avec cette adresse.",
  admin: "Ce compte est administrateur : retirez-lui d'abord ce rôle (page Administrateurs).",
  "deja-efface": "Ce compte a déjà été effacé.",
  "solde-vendeur":
    "Ce vendeur a encore de l'argent à recevoir. Réglez ses versements (page Versements) avant l'effacement.",
  "versement-en-cours":
    "Ce vendeur a un versement en cours. Traitez-le (page Versements) avant l'effacement.",
};

export default async function AdminEffacementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const me = await requireAdmin("/admin/effacement");
  const needsCode = Boolean(me.totpEnabledAt);

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Effacement d&apos;un compte</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pour répondre à la demande d&apos;un utilisateur qui souhaite supprimer son compte
          (reçue par le support, par email ou par le formulaire de contact). L&apos;utilisateur peut
          aussi le faire lui-même depuis « Mon profil ».
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="card text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Ce qui se passe</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Le nom, l&apos;email, le téléphone et le mot de passe sont effacés. Les connexions en cours sont
            coupées. Les messages de contact et le contenu des conversations de support sont supprimés.
          </li>
          <li>
            Les <strong>commandes sont conservées</strong> (numéros, montants, dates) pour la
            comptabilité, mais sans lien avec une adresse email.
          </li>
          <li>
            Pour un vendeur : son profil public est effacé et ses ouvrages sont retirés de la vente.
            Les acheteurs qui les ont déjà achetés gardent leur accès.
          </li>
          <li>
            <strong>L&apos;effacement est refusé</strong> si le compte est administrateur, ou si un
            vendeur a de l&apos;argent à recevoir ou un versement en cours.
          </li>
          <li>
            <strong>Il est irréversible.</strong> Les sauvegardes de la base (Neon) peuvent contenir les
            anciennes données jusqu&apos;à leur expiration, et les emails déjà envoyés ne peuvent pas être
            repris.
          </li>
        </ul>
      </section>

      <section className="card border-red-200">
        <h2 className="text-lg font-semibold">Effacer un compte</h2>

        <form action={eraseAccountByAdminAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="erase-email" className="label">
              Adresse email du compte à effacer
            </label>
            <input
              id="erase-email"
              name="email"
              type="email"
              required
              className="input max-w-md"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="erase-password" className="label">
                Votre mot de passe
              </label>
              <input
                id="erase-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
              />
            </div>
            {needsCode && (
              <div>
                <label htmlFor="erase-code" className="label">
                  Votre code à 6 chiffres
                </label>
                <input
                  id="erase-code"
                  name="code"
                  type="text"
                  autoComplete="one-time-code"
                  maxLength={20}
                  required
                  className="input"
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="erase-confirmation" className="label">
              Pour confirmer, saisissez le mot EFFACER
            </label>
            <input
              id="erase-confirmation"
              name="confirmation"
              type="text"
              autoComplete="off"
              required
              className="input max-w-[12rem]"
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" value="oui" required className="mt-1" />
            <span>
              Je confirme que cette personne a demandé l&apos;effacement de son compte et que cette
              action est définitive.
            </span>
          </label>

          <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700">
            Effacer le compte
          </button>
        </form>
      </section>
    </div>
  );
}
