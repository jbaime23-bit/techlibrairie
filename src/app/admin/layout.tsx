// src/app/admin/layout.tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

const LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/sante", label: "Santé du site" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/vendeurs", label: "Vendeurs" },
  { href: "/admin/produits", label: "Produits" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/versements", label: "Versements" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/publicites", label: "Publicités" },
  { href: "/admin/messages", label: "Messages de contact" },
  { href: "/admin/taux", label: "Taux de change" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/maintenance", label: "Maintenance" },
  { href: "/admin/parametres", label: "Paramètres" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin("/admin");

  return (
    <div className="container-page py-8">
      <nav className="mb-8 flex flex-wrap gap-2 border-b border-slate-200 pb-4 text-sm font-medium">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="btn-secondary">
            {link.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
