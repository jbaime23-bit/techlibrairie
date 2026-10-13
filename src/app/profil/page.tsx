// src/app/profil/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/app/profil/actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mon profil",
};

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  BUYER: "Acheteur",
  SELLER: "Vendeur",
  ADMIN: "Administrateur",
} as const;

const MESSAGES: Record<string, string> = {
  "profil-modifie": "Vos informations ont été enregistrées.",
};

const ERRORS: Record<string, string> = {
  nom: "Le nom doit contenir au moins 2 caractères.",
  telephone: "Numéro de téléphone invalide (chiffres, espaces, +, ( ) et - uniquement).",
  "mot-de-passe-actuel": "Le mot de passe actuel est incorrect.",
  nouveau:
    "Le nouveau mot de passe doit contenir 8 caractères minimum, avec au moins une lettre et un chiffre.",
  confirmation: "Les deux nouveaux mots de passe ne correspondent pas.",
  identique: "Le nouveau mot de passe doit être différent de l'actuel.",
  limite: "Trop de tentatives échouées. Patientez 15 minutes avant de réessayer.",
  indisponible: "Ce compte n'a pas de mot de passe modifiable.",
};

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const sessionUser = await requireUser("/profil");

  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      email: true,
      phone: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  const messageKey = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const error = errorKey ? ERRORS[errorKey] : undefined;

  if (!account) {
    return null;
  }

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Mon profil</h1>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </div>
        )}
        {error && <div className="alert-error">{error}</div>}

        <section className="card">
          <h2 className="text-lg font-semibold">Mes informations</h2>

          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex flex-wrap gap-2">
              <dt className="text-slate-500">Adresse email :</dt>
              <dd className="font-medium">
                {account.email}{" "}
                {account.emailVerified ? (
                  <span className="text-green-700">(vérifiée)</span>
                ) : (
                  <Link
                    href="/verifier-email"
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    (non vérifiée : la vérifier)
                  </Link>
                )}
              </dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-slate-500">Type de compte :</dt>
              <dd className="font-medium">{ROLE_LABELS[account.role]}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-slate-500">Inscrit le :</dt>
              <dd className="font-medium">{formatDate(account.createdAt)}</dd>
            </div>
          </dl>

          <form action={updateProfileAction} className="mt-5 space-y-4">
            <div>
              <label htmlFor="name" className="label">
                Nom complet
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={account.name ?? ""}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Téléphone (facultatif)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={30}
                defaultValue={account.phone ?? ""}
                className="input"
              />
            </div>

            <button type="submit" className="btn-primary">
              Enregistrer
            </button>
          </form>

          {account.role === "SELLER" && (
            <p className="mt-4 text-sm text-slate-600">
              Pour modifier votre nom d&apos;auteur et votre présentation publique,
              ouvrez{" "}
              <Link
                href="/vendeur/profil"
                className="font-semibold text-brand-700 hover:underline"
              >
                votre profil vendeur
              </Link>
              .
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold">Changer mon mot de passe</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pour votre sécurité, vous serez déconnecté de tous vos appareils après
            ce changement.
          </p>

          <form action={changePasswordAction} className="mt-4 space-y-4">
            <div>
              <label htmlFor="currentPassword" className="label">
                Mot de passe actuel
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                className="input"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="label">
                Nouveau mot de passe
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                className="input"
              />
              <p className="mt-1 text-xs text-slate-500">
                8 caractères minimum, avec au moins une lettre et un chiffre.
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirmer le nouveau mot de passe
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="input"
              />
            </div>

            <button type="submit" className="btn-primary">
              Changer le mot de passe
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
