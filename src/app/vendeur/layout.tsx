// src/app/vendeur/layout.tsx
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import AdSlot from "@/components/publicite/AdSlot";

export default async function VendeurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["SELLER", "ADMIN"], "/vendeur");

  return (
    <div className="container-page py-8">
      <nav className="mb-8 flex flex-wrap gap-2 border-b border-slate-200 pb-4 text-sm font-medium">
        <Link href="/vendeur" className="btn-secondary">
          Tableau de bord
        </Link>
        <Link href="/vendeur/produits" className="btn-secondary">
          Mes produits
        </Link>
        <Link href="/vendeur/produits/nouveau" className="btn-primary">
          Nouveau produit
        </Link>
      </nav>

      {children}

      <div className="mt-10">
        <AdSlot placement="SELLER_DASHBOARD" />
      </div>
    </div>
  );
}
