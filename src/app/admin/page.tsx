// src/app/admin/page.tsx
import { requireAdminForSetup } from "@/lib/admin";

interface PageProps {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPage({}: PageProps) {
  // Vérification des accès admin
  await requireAdminForSetup("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord Administrateur</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bienvenue dans l&apos;espace de gestion de votre plateforme **TechLibrairie**.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="card bg-white p-6 shadow-sm border border-slate-100 rounded-xl">
          <h2 className="font-semibold text-slate-700">Aperçu de l&apos;activité</h2>
          <p className="text-sm text-slate-500 mt-2">Sélectionnez une option dans le menu ci-dessus pour commencer.</p>
        </div>
      </div>
    </div>
  );
}
