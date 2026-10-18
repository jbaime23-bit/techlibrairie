// src/app/profil/email/confirmer/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { findValidToken, parseChangePayload } from "@/lib/account-tokens";
import { confirmEmailChangeAction } from "@/app/profil/email/actions";

export const metadata: Metadata = {
  title: "Confirmer mon nouvelle adresse email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConfirmerEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const sp = await searchParams;

  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = rawToken ?? "";

  // Il faut être connecté au compte concerné pour confirmer le changement.
  const user = await requireUser(`/profil/email/confirmer?token=${token}`);

  const valid = token ? await findValidToken("change", token) : null;
  const payload = valid ? parseChangePayload(valid.email) : null;
  const usable = payload !== null && payload.userId === user.id;

  // Préparation de l'action avec le token lié
  const boundAction = confirmEmailChangeAction.bind(null, token);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md">
        <div className="card space-y-4">
          <h1 className="text-2xl font-bold">Confirmer ma nouvelle adresse email</h1>

          {usable && payload ? (
            <>
              <p className="text-sm text-slate-700">
                Vous êtes sur le point de remplacer l&apos;adresse de connexion de votre compte :
              </p>

              <dl className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div>
                  <dt className="text-slate-500">Adresse actuelle</dt>
                  <dd className="font-medium">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Nouvelle adresse</dt>
                  <dd className="font-medium">{payload.newEmail}</dd>
                </div>
              </dl>

              {/* Remplacement direct par l'action liée */}
              <form action={boundAction}>
                <button type="submit" className="btn-primary w-full">
                  Confirmer le changement
                </button>
              </form>

              <p className="text-xs text-slate-500">
                Si vous n&apos;êtes pas à l&apos;origine de cette demande, ne confirmez pas :
                fermez simplement cette page.
              </p>
            </>
          ) : (
            <>
              <div className="alert-error">
                Ce lien est invalide, expiré (il est valable 1 heure), ou n&apos;appartient pas au
                compte actuellement connecté ({user.email}). Si vous avez plusieurs comptes,
                connectez-vous avec le bon.
              </div>
              <Link href="/profil/email" className="btn-primary w-full">
                Faire une nouvelle demande
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
                }
