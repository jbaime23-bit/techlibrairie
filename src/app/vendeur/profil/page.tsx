// src/app/vendeur/profil/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { firstParam } from "@/lib/admin";
import { loadSellerPage } from "@/lib/seller";
import { SellerUnavailable } from "@/components/vendeur/seller-unavailable";
import { updateSellerProfileAction } from "@/app/vendeur/profil/actions";

export const metadata: Metadata = {
  title: "Mon profil vendeur",
};

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  compte: "Votre compte vendeur ne permet pas cette opération.",
  nom: "Le nom d'auteur ou d'éditeur doit contenir au moins 2 caractères.",
};

export default async function VendeurProfilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const context = await loadSellerPage("/vendeur/profil");

  if (context.status !== "ok") {
    return <SellerUnavailable reason={context.status} />;
  }

  const { seller } = context;

  const message = firstParam(sp.message);
  const errorKey = firstParam(sp.erreur);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Mon profil vendeur</h1>

      {message === "enregistre" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Votre profil public a été mis à jour.
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      <section className="card">
        <p className="text-sm text-slate-600">
          Ces informations sont visibles par tous les visiteurs sur votre page
          publique :{" "}
          <Link
            href={`/auteurs/${seller.slug}`}
            className="font-semibold text-brand-700 hover:underline"
          >
            voir ma page
          </Link>
          .
        </p>

        <form action={updateSellerProfileAction} className="mt-5 space-y-4">
          <div>
            <label htmlFor="displayName" className="label">
              Nom d&apos;auteur ou d&apos;éditeur
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              minLength={2}
              maxLength={80}
              defaultValue={seller.displayName}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="bio" className="label">
              Présentation (facultatif, 1000 caractères maximum)
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={6}
              maxLength={1000}
              defaultValue={seller.bio ?? ""}
              className="input"
            />
          </div>

          <button type="submit" className="btn-primary">
            Enregistrer
          </button>
        </form>
      </section>
    </div>
  );
}
