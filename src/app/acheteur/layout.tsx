// src/app/acheteur/layout.tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function AcheteurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/acheteur");

  return (
    <div className="container-page py-8">
      <nav className="mb-8 flex flex-wrap gap-2 border-b border-slate-200 pb-4 text-sm font-medium">
        <Link href="/acheteur" className="btn-secondary">
          Mon espace
        </Link>
        <Link href="/acheteur/commandes" className="btn-secondary">
          Mes commandes
        </Link>
        <Link href="/favoris" className="btn-secondary">
          Mes favoris
        </Link>
        <Link href="/catalogue" className="btn-primary">
          Catalogue
        </Link>
      </nav>

      {children}
    </div>
  );
}
