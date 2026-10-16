// src/app/admin/administrateurs/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdmin } from "@/lib/admin";
import {
  demoteAdminAction,
  promoteAdminAction,
} from "@/app/admin/administrateurs/actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Administrateurs",
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  promu:
    "Administrateur nommé. Il doit se déconnecter puis se reconnecter, et activer la double authentification.",
  retrograde: "Rôle d'administrateur retiré : le compte est déconnecté de ses appareils.",
};

const ERRORS: Record<string, string> = {
  email: "Adresse email invalide.",
  limite: "Trop de tentatives échouées. Patientez 15 minutes avant de réessayer.",
  "mot-de-passe": "Votre mot de passe est incorrect.",
  code: "Votre code de double authentification est incorrect.",
  introuvable: "Compte introuvable ou inactif.",
  "deja-admin": "Ce compte est déjà administrateur.",
  "non-verifie":
    "Ce compte n'a pas vérifié son adresse email. L'utilisateur doit d'abord la vérifier (page « Mon profil »).",
  "soi-meme": "Vous ne pouvez pas retirer votre propre rôle d'administrateur.",
  dernier: "Impossible : il doit rester au moins un administrateur actif.",
};

function ReauthFields({ prefix, needsCode }: { prefix: string; needsCode: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${prefix}-password`} className="label">
          Votre mot de passe
        </label>
        <input
          id={`${prefix}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      {needsCode && (
        <div>
          <label htmlFor={`${prefix}-code`} className="label">
            Votre code à 6 chiffres
          </label>
          <input
            id={`${prefix}-code`}
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
  );
}

export default async function AdminAdministrateursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const me = await requireAdmin("/admin/administrateurs");
  const needsCode = Boolean(me.totpEnabledAt);

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      totpEnabledAt: true,
    },
  });

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administrateurs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Nommer ou retirer un administrateur exige votre mot de passe
          {needsCode ? " et un code de double authentification" : ""}.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="card">
        <h2 className="text-lg font-semibold">Administrateurs actuels ({admins.length})</h2>

        <ul className="mt-4 space-y-4">
          {admins.map((item) => {
            const isMe = item.id === me.id;

            return (
              <li key={item.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {item.name ?? "Sans nom"}
                      {isMe ? " (vous)" : ""}
                    </p>
                    <p className="text-sm text-slate-600">{item.email}</p>
                    <p className="text-xs text-slate-500">
                      Administrateur depuis le {formatDate(item.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-xs">
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${
                        item.totpEnabledAt
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {item.totpEnabledAt
                        ? "Double authentification activée"
                        : "Double authentification non activée"}
                    </span>
                    {!item.isActive && (
                      <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-800">
                        Compte désactivé
                      </span>
                    )}
                  </div>
                </div>

                {!isMe && (
                  <form action={demoteAdminAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    <input type="hidden" name="userId" value={item.id} />
                    <ReauthFields prefix={`demote-${item.id}`} needsCode={needsCode} />
                    <button type="submit" className="btn-secondary px-3 py-1 text-xs text-red-700">
                      Retirer le rôle d&apos;administrateur
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Nommer un administrateur</h2>
        <p className="mt-1 text-sm text-slate-600">
          Le compte doit déjà exister, être actif et avoir vérifié son adresse email. Après sa
          nomination, la personne doit se déconnecter puis se reconnecter, puis activer la double
          authentification avant d&apos;accéder à l&apos;administration.
        </p>

        <form action={promoteAdminAction} className="mt-4 space-y-3">
          <div>
            <label htmlFor="promote-email" className="label">
              Adresse email du compte
            </label>
            <input
              id="promote-email"
              name="email"
              type="email"
              required
              className="input max-w-md"
            />
          </div>

          <ReauthFields prefix="promote" needsCode={needsCode} />

          <button type="submit" className="btn-primary">
            Nommer administrateur
          </button>
        </form>
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">Bon à savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Un administrateur a accès à toutes les données de la boutique : ne nommez que des
            personnes de confiance.
          </li>
          <li>
            Retirer un administrateur efface sa double authentification et coupe ses sessions. Son
            compte redevient vendeur ou acheteur.
          </li>
          <li>Ces opérations sont enregistrées dans le Journal.</li>
        </ul>
      </section>
    </div>
  );
          }
