// src/app/admin/securite/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { firstParam, requireAdminForSetup } from "@/lib/admin";
import { TwoFactorPanel } from "@/components/admin/two-factor-panel";
import { isTwoFactorRequired } from "@/lib/two-factor";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sécurité du compte",
};

export const dynamic = "force-dynamic";

export default async function AdminSecuritePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const sessionUser = await requireAdminForSetup("/admin/securite");

  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      email: true,
      totpEnabledAt: true,
      totpSecretEnc: true,
      totpRecoveryHashes: true,
    },
  });

  const enabled = Boolean(account?.totpEnabledAt && account?.totpSecretEnc);
  const required = isTwoFactorRequired();
  const forced = firstParam(sp.obligatoire) === "1" && !enabled;

  const resetEmail = process.env.RESET_2FA_EMAIL?.trim().toLowerCase();
  const resetVariableActive = Boolean(resetEmail);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Sécurité du compte administrateur</h1>

      {forced && (
        <div className="alert-error">
          <p className="font-semibold">Action requise</p>
          <p className="mt-1">
            L&apos;accès à l&apos;administration exige la double authentification. Activez-la
            ci-dessous pour continuer.
          </p>
        </div>
      )}

      {!required && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          La double authentification n&apos;est pas obligatoire actuellement (variable
          ADMIN_2FA_REQUIRED définie à « false » dans Vercel). Supprimez cette variable pour
          la rendre de nouveau obligatoire.
        </div>
      )}

      {resetVariableActive && (
        <div className="alert-error">
          <p className="font-semibold">Variable de secours RESET_2FA_EMAIL présente dans Vercel</p>
          <p className="mt-1">
            Tant qu&apos;elle existe, le compte concerné se connecte avec le seul mot de passe
            et la double authentification est effacée à chaque connexion. Une fois votre
            accès rétabli, <strong>supprimez cette variable</strong> et réactivez la double
            authentification.
          </p>
        </div>
      )}

      <section className="card">
        <p className="mb-4 text-sm text-slate-600">
          Compte : <strong>{account?.email ?? "-"}</strong>
        </p>

        <TwoFactorPanel
          enabled={enabled}
          enabledAtLabel={account?.totpEnabledAt ? formatDate(account.totpEnabledAt) : null}
          recoveryRemaining={account?.totpRecoveryHashes.length ?? 0}
        />
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Si vous perdez votre téléphone, utilisez un <strong>code de secours</strong> à la
            place du code à 6 chiffres, puis réactivez la double authentification.
          </li>
          <li>
            Sans téléphone ni codes de secours : ajoutez la variable <code>RESET_2FA_EMAIL</code>{" "}
            (votre adresse email d&apos;administrateur) dans Vercel, redéployez, connectez-vous
            avec le seul mot de passe, puis supprimez la variable.
          </li>
          <li>
            Changer la variable <code>NEXTAUTH_SECRET</code> rend la clé enregistrée illisible :
            vous devrez alors passer par un code de secours ou par la variable ci-dessus.
          </li>
          <li>
            Ne partagez jamais un code temporaire ni un code de secours, même avec quelqu&apos;un
            qui se présente comme l&apos;équipe TechLibrairie.
          </li>
        </ul>
      </section>
    </div>
  );
}
