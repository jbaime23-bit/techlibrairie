// src/app/admin/layout.tsx
// La mise en page n'exige que le rôle administrateur : la double authentification
// est exigée par chaque page (sauf /admin/securite, qui permet de l'activer).
import Link from "next/link";
import { requireAdminForSetup } from "@/lib/admin";

const LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/statistiques", label: "Statistiques" },
  { href: "/admin/manuel", label: "Manuel" },
  { href: "/admin/securite", label: "Sécurité du compte" },
  { href: "/admin/administrateurs", label: "Administrateurs" },
  { href: "/admin/journal", label: "Journal" },
  { href: "/admin/sante", label: "Santé du site" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/effacement", label: "Effacement" },
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
  await requireAdminForSetup("/admin");

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
