// src/app/publier/active/page.tsx
// Page de confirmation après l'ouverture de l'espace de publication d'un acheteur :
// sa session a été fermée, il doit se reconnecter pour que son nouveau rôle soit pris en compte.
import type { Metadata } from "next";
import Link from "next/link";
import { firstParam } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Espace de publication activé",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PROFILES = ["auteur", "editeur", "vendeur"];

export default async function PublierActivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const rawProfile = firstParam(sp.profil);
  const profile = rawProfile && PROFILES.includes(rawProfile) ? rawProfile : "auteur";

  const target = `/vendeur/produits/nouveau?profil=${profile}`;
  const loginHref = `/connexion?callbackUrl=${encodeURIComponent(target)}`;

  return (
    <div className="container-page py-12">
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold">Votre espace de publication est prêt</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pour des raisons de sécurité, vous avez été déconnecté. Reconnectez-vous avec les mêmes
          identifiants : vous arriverez directement sur le formulaire de publication.
        </p>
        <div className="mt-6">
          <Link href={loginHref} className="btn-primary">
            Me reconnecter
          </Link>
        </div>
      </div>
    </div>
  );
}
