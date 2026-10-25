// src/app/vendeur/activer/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { firstParam } from "@/lib/admin";
import { activateSellerProfileAction } from "@/app/vendeur/activer/actions";

export const metadata: Metadata = {
  title: "Activer mon profil vendeur",
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  nom: "Le nom d'auteur ou d'éditeur doit contenir au moins 2 caractères.",
  technique: "Une erreur est survenue. Réessayez dans un instant.",
};

export default async function ActiverProfilVendeurPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const user = await requireRole(["SELLER", "ADMIN"], "/vendeur/activer");

  const existing = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) {
    redirect("/vendeur");
  }

  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Activer mon profil vendeur</h1>

      {error && <div className="alert-error">{error}</div>}

      <section className="card">
        <p className="text-sm text-slate-700">
          Votre compte{user.role === "ADMIN" ? " administrateur" : ""} peut aussi vendre des PDF.
          Créez votre profil public d&apos;auteur ou d&apos;éditeur : vous pourrez ensuite déposer vos
          livres, avec leur fichier PDF et leur photo de couverture. Votre rôle ne change pas.
        </p>

        <form action={activateSellerProfileAction} className="mt-5 space-y-4">
          <div>
            <label htmlFor="displayName" className="label">
              Nom d&apos;auteur ou d&apos;éditeur (affiché au public)
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              minLength={2}
              maxLength={80}
              defaultValue={user.name ?? ""}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="bio" className="label">
              Présentation (facultatif, 1000 caractères maximum)
            </label>
            <textarea id="bio" name="bio" rows={5} maxLength={1000} className="input" />
          </div>

          <button type="submit" className="btn-primary">
            Activer mon profil vendeur
          </button>
        </form>
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">À savoir</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            La commission de la boutique s&apos;applique aussi à vos propres ventes. Vous pouvez la
            régler pour votre profil dans{" "}
            <Link href="/admin/vendeurs" className="font-semibold text-brand-700 hover:underline">
              Administration, Vendeurs
            </Link>{" "}
            (0 % pour ne rien prélever).
          </li>
          <li>Vous ne pouvez pas acheter vos propres ouvrages.</li>
          <li>
            Pour des PDF distribués gratuitement avec attente publicitaire, utilisez plutôt{" "}
            <Link href="/admin/gratuit" className="font-semibold text-brand-700 hover:underline">
              Administration, PDF gratuits
            </Link>
            .
          </li>
        </ul>
      </section>
    </div>
  );
            }
