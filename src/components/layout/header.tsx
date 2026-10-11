// src/components/layout/header.tsx
import Link from "next/link";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/components/layout/sign-out-button";

const SPACE_BY_ROLE: Record<Role, { href: string; label: string }> = {
  BUYER: { href: "/acheteur", label: "Mon espace" },
  SELLER: { href: "/vendeur", label: "Espace vendeur" },
  ADMIN: { href: "/admin", label: "Administration" },
};

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-4">
        <Link href="/" className="text-xl font-bold text-brand-700">
          TechLibrairie
        </Link>

        <nav className="flex flex-wrap items-center gap-3 text-sm font-medium">
          <Link href="/catalogue" className="text-slate-700 hover:text-brand-700">
            Catalogue
          </Link>

          {user ? (
            <>
              <Link
                href={SPACE_BY_ROLE[user.role].href}
                className="text-slate-700 hover:text-brand-700"
              >
                {SPACE_BY_ROLE[user.role].label}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/connexion" className="btn-secondary">
                Connexion
              </Link>
              <Link href="/inscription" className="btn-primary">
                Inscription
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
  }
